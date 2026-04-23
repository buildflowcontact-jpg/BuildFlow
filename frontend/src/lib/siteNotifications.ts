import { supabase } from './supabase'

export type SiteAlertNotification = {
  code: 'overdue_supplies' | 'expired_qualifications' | 'phase_budget_overrun' | 'safety_checklist_pending' | 'qualifications_expiring_soon' | 'equipment_conflicts' | 'critical_incidents'
  level: 'critical' | 'warning' | 'info'
  title: string
  detail: string
}

type ExistingNotification = {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  read: boolean
}

export const SITE_ALERT_TYPES: Record<SiteAlertNotification['code'], string> = {
  overdue_supplies: 'site_alert_overdue_supplies',
  expired_qualifications: 'site_alert_expired_qualifications',
  phase_budget_overrun: 'site_alert_phase_budget_overrun',
  safety_checklist_pending: 'site_alert_safety_checklist_pending',
  qualifications_expiring_soon: 'site_alert_qualifications_expiring_soon',
  equipment_conflicts: 'site_alert_equipment_conflicts',
  critical_incidents: 'site_alert_critical_incidents',
}

export const SITE_ALERT_SECTION_BY_TYPE: Record<string, string> = {
  [SITE_ALERT_TYPES.overdue_supplies]: 'supplies',
  [SITE_ALERT_TYPES.expired_qualifications]: 'qualifications',
  [SITE_ALERT_TYPES.phase_budget_overrun]: 'phases',
  [SITE_ALERT_TYPES.safety_checklist_pending]: 'safety',
  [SITE_ALERT_TYPES.qualifications_expiring_soon]: 'qualifications',
  [SITE_ALERT_TYPES.equipment_conflicts]: 'equipment',
  [SITE_ALERT_TYPES.critical_incidents]: 'incidents',
}

const MANAGED_TYPES = Object.values(SITE_ALERT_TYPES)

function buildBody(alert: SiteAlertNotification): string {
  return `[${alert.level.toUpperCase()}] ${alert.detail}`
}

export function getSiteSectionFromNotificationType(type: string): string | null {
  return SITE_ALERT_SECTION_BY_TYPE[type] ?? null
}

export async function syncSiteAlertsNotifications(projectId: string, alerts: SiteAlertNotification[]): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser()
  if (!userRes.user) return

  const { data: memberRows } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId)

  const recipientIds = Array.from(new Set((memberRows || []).map((row) => row.user_id).filter(Boolean))) as string[]
  if (recipientIds.length === 0) return

  const activeByType = new Map<string, SiteAlertNotification>()
  for (const alert of alerts) {
    activeByType.set(SITE_ALERT_TYPES[alert.code], alert)
  }

  const { data: existingRows } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, read')
    .eq('project_id', projectId)
    .in('user_id', recipientIds)
    .in('type', MANAGED_TYPES)
    .eq('read', false)

  const existing = (existingRows || []) as ExistingNotification[]
  const existingMap = new Map<string, ExistingNotification>()
  for (const row of existing) {
    existingMap.set(`${row.user_id}:${row.type}`, row)
  }

  for (const userId of recipientIds) {
    for (const type of MANAGED_TYPES) {
      const current = existingMap.get(`${userId}:${type}`)
      const alert = activeByType.get(type)

      if (alert) {
        const title = alert.title
        const body = buildBody(alert)

        if (!current) {
          await supabase.from('notifications').insert({
            user_id: userId,
            project_id: projectId,
            type,
            title,
            body,
            read: false,
          })
        } else if (current.title !== title || current.body !== body || current.read) {
          await supabase
            .from('notifications')
            .update({ title, body, read: false, created_at: new Date().toISOString() })
            .eq('id', current.id)
        }
      } else if (current && !current.read) {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', current.id)
      }
    }
  }
}
