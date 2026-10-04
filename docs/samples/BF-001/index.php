<?php
// BF-001: Student Portal — lists students from MySQL via Apache.
$db = new mysqli('localhost', 'portal_user', 's3cureP@ss', 'student_portal');
if ($db->connect_error) {
    http_response_code(500);
    exit('Database connection failed');
}
$result = $db->query('SELECT id, name, email, course FROM students ORDER BY id');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Riverside Community College — Student Portal</title>
</head>
<body>
  <h1>Enrolled Students</h1>
  <table border="1" cellpadding="6">
    <tr><th>ID</th><th>Name</th><th>Email</th><th>Course</th></tr>
    <?php while ($row = $result->fetch_assoc()): ?>
      <tr>
        <td><?= htmlspecialchars($row['id']) ?></td>
        <td><?= htmlspecialchars($row['name']) ?></td>
        <td><?= htmlspecialchars($row['email']) ?></td>
        <td><?= htmlspecialchars($row['course']) ?></td>
      </tr>
    <?php endwhile; ?>
  </table>
</body>
</html>
