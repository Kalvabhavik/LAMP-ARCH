<?php
// NC-001: Employee Portal login — prepared statements, password_verify, sessions.
declare(strict_types=1);
require_once __DIR__ . '/config.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';
    try {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT id, username, password_hash FROM users WHERE username = ?');
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        if ($user && password_verify($password, $user['password_hash'])) {
            session_regenerate_id(true);
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            header('Location: /dashboard.php');
            exit;
        }
        $error = 'Invalid credentials';
    } catch (Throwable $e) {
        error_log('Login error: ' . $e->getMessage());
        $error = 'Something went wrong. Please try again.';
    }
}

// Registration helper for admins (uses password_hash).
function create_user(PDO $pdo, string $username, string $email, string $password): void
{
    $stmt = $pdo->prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
    $stmt->execute([$username, $email, password_hash($password, PASSWORD_DEFAULT)]);
}
?>
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>NexaCore Employee Portal — Login</title></head>
<body>
  <?php if (!empty($error)): ?><p><?= htmlspecialchars($error) ?></p><?php endif; ?>
  <form method="post">
    <input name="username" placeholder="Username" required>
    <input name="password" type="password" placeholder="Password" required>
    <button type="submit">Sign in</button>
  </form>
</body>
</html>
