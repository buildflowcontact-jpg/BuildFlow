SELECT r.rolname as member, p.rolname as role_of
FROM pg_auth_members m
JOIN pg_roles r ON r.oid = m.member
JOIN pg_roles p ON p.oid = m.roleid
WHERE r.rolname = 'postgres'
