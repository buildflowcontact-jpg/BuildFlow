// Export utilities for PDF and Excel

import { jsPDF } from 'jspdf'

export interface ExportOptions {
  format: 'pdf' | 'excel'
  includeAttachments?: boolean
  includeComments?: boolean
  includeTimeLog?: boolean
  dateRange?: { start: string; end: string }
}

// Export tasks to CSV (Excel compatible)
export function exportTasksToCSV(
  tasks: any[],
  filename: string = 'tasks.csv'
): void {
  const headers = [
    'ID',
    'Titre',
    'Description',
    'Statut',
    'Priorité',
    'Assigné à',
    'Date de début',
    'Date d\'échéance',
    'Créé le',
  ]

  const rows = tasks.map((task) => [
    task.id,
    task.title,
    task.description || '',
    task.status,
    task.priority,
    task.assigned_to || '',
    task.start_date || '',
    task.end_date || task.due_date || '',
    task.created_at,
  ])

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  downloadFile(csv, filename, 'text/csv')
}

// Export tasks to JSON
export function exportTasksToJSON(tasks: any[], filename: string = 'tasks.json'): void {
  const json = JSON.stringify(tasks, null, 2)
  downloadFile(json, filename, 'application/json')
}

// Export projects to CSV
export function exportProjectsToCSV(
  projects: any[],
  filename: string = 'projects.csv'
): void {
  const headers = ['ID', 'Nom', 'Description', 'Statut', 'Date de début', 'Date de fin', 'Budget', 'Créé le']

  const rows = projects.map((proj) => [
    proj.id,
    proj.name,
    proj.description || '',
    proj.status,
    proj.start_date || '',
    proj.end_date || '',
    proj.budget || '',
    proj.created_at,
  ])

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  downloadFile(csv, filename, 'text/csv')
}

// Export expenses report
export function exportExpensesReport(
  expenses: any[],
  filename: string = 'expenses-report.csv'
): void {
  const headers = ['Date', 'Catégorie', 'Montant', 'Statut', 'Description']

  const rows = expenses.map((exp) => [exp.date, exp.category, exp.amount, exp.status, exp.description || ''])

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ['', '', `TOTAL: ${expenses.reduce((sum, e) => sum + (e.amount || 0), 0).toFixed(2)}`],
  ].join('\n')

  downloadFile(csv, filename, 'text/csv')
}

// Export time log
export function exportTimeLogToCSV(
  timeEntries: any[],
  filename: string = 'time-log.csv'
): void {
  const headers = ['Date', 'Tâche', 'Utilisateur', 'Heures', 'Notes']

  const rows = timeEntries.map((entry) => [
    entry.date,
    entry.task_id,
    entry.user_id,
    entry.hours,
    entry.notes || '',
  ])

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ['', '', '', `TOTAL: ${timeEntries.reduce((sum, e) => sum + (e.hours || 0), 0).toFixed(2)}h`],
  ].join('\n')

  downloadFile(csv, filename, 'text/csv')
}

// Generate simple PDF report (uses HTML)
export function generateTasksPDF(tasks: any[], projectName: string = 'Project Report'): void {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${projectName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f8f9fa; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .status-todo { color: #999; }
          .status-done { color: #28a745; font-weight: bold; }
          .priority-urgent { color: #dc3545; font-weight: bold; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <h1>${projectName}</h1>
        <p>Rapport généré le ${new Date().toLocaleDateString('fr-FR')}</p>
        
        <h2>Résumé</h2>
        <ul>
          <li>Total des tâches: ${tasks.length}</li>
          <li>Complétées: ${tasks.filter((t) => t.status === 'done').length}</li>
          <li>En cours: ${tasks.filter((t) => t.status === 'in-progress').length}</li>
          <li>À faire: ${tasks.filter((t) => t.status === 'todo').length}</li>
        </ul>

        <h2>Détails des tâches</h2>
        <table>
          <thead>
            <tr>
              <th>Titre</th>
              <th>Statut</th>
              <th>Priorité</th>
              <th>Échéance</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${tasks
              .map(
                (task) => `
              <tr>
                <td><strong>${task.title}</strong></td>
                <td class="status-${task.status}">${formatStatus(task.status)}</td>
                <td class="priority-${task.priority}">${formatPriority(task.priority)}</td>
                <td>${task.end_date || task.due_date || '-'}</td>
                <td>${task.description || '-'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Généré par BuildFlow • ${new Date().toLocaleString('fr-FR')}</p>
        </div>
      </body>
    </html>
  `

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${projectName}-report.html`
  link.click()
  URL.revokeObjectURL(url)
}

export function exportProjectsToPDFReport(projects: any[], filenamePrefix: string = 'buildflow-rapport'): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const marginX = 14
  const pageWidth = 210
  const usableWidth = pageWidth - marginX * 2
  const lineHeight = 6
  const maxY = 285
  let y = 16

  const totalProjects = projects.length
  const allTasks = projects.flatMap((project) => project.tasks ?? [])
  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter((task) => task.status === 'done' || task.status === 'completed').length
  const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

  const ensureRoom = (needed = lineHeight) => {
    if (y + needed > maxY) {
      doc.addPage()
      y = 16
    }
  }

  const writeWrapped = (text: string, indent = 0, fontSize = 10) => {
    const value = text || '-'
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(value, usableWidth - indent)
    lines.forEach((line: string) => {
      ensureRoom(lineHeight)
      doc.text(line, marginX + indent, y)
      y += lineHeight
    })
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('BuildFlow - Rapport PDF', marginX, y)
  y += 9

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, marginX, y)
  y += 10

  doc.setDrawColor(226, 232, 240)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Synthèse', marginX, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  writeWrapped(`Projets: ${totalProjects}`)
  writeWrapped(`Tâches: ${totalTasks}`)
  writeWrapped(`Tâches terminées: ${completedTasks}`)
  writeWrapped(`Taux de complétion: ${completionRate}%`)
  y += 3

  doc.setDrawColor(226, 232, 240)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Détails par projet', marginX, y)
  y += 7

  projects.forEach((project: any, index: number) => {
    const tasks = project.tasks ?? []
    const done = tasks.filter((task: any) => task.status === 'done' || task.status === 'completed').length
    const rate = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100)

    ensureRoom(16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`${index + 1}. ${project.name || 'Projet sans nom'}`, marginX, y)
    y += lineHeight

    doc.setFont('helvetica', 'normal')
    writeWrapped(`Statut: ${project.status || '-'}`, 2, 10)
    writeWrapped(`Budget: ${Number(project.budget ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}`, 2, 10)
    writeWrapped(`Tâches: ${done}/${tasks.length} (${rate}%)`, 2, 10)

    if (tasks.length > 0) {
      writeWrapped('Top tâches:', 2, 10)
      tasks.slice(0, 6).forEach((task: any) => {
        const due = task.dueDate || task.due_date || '-'
        const status = formatStatus(task.status || '')
        writeWrapped(`- ${task.title || 'Sans titre'} (${status}, échéance: ${due})`, 6, 9)
      })
      if (tasks.length > 6) {
        writeWrapped(`... ${tasks.length - 6} tâche(s) supplémentaire(s)`, 6, 9)
      }
    }

    y += 3
  })

  const filename = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}

// Generic file download
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    todo: 'À faire',
    'in-progress': 'En cours',
    review: 'Révision',
    done: 'Complétée',
  }
  return labels[status] || status
}

function formatPriority(priority: string): string {
  const labels: Record<string, string> = {
    low: 'Basse',
    medium: 'Moyenne',
    high: 'Haute',
    urgent: 'Urgente',
  }
  return labels[priority] || priority
}
