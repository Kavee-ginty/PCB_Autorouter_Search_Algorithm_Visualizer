<?php
/**
 * boards.php - API endpoint for saving, loading, and deleting PCB board states and routing logs
 */

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (isset($_GET['id'])) {
        $stmt = $pdo->prepare("SELECT * FROM saved_boards WHERE id = ?");
        $stmt->execute([(int)$_GET['id']]);
        $board = $stmt->fetch();
        if ($board) {
            $board['components'] = json_decode($board['components_json'], true);
            $board['netlist'] = json_decode($board['netlist_json'], true);
            echo json_encode(['success' => true, 'data' => $board]);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Board not found']);
        }
    } else {
        $stmt = $pdo->query("SELECT id, title, created_at, updated_at FROM saved_boards ORDER BY updated_at DESC");
        $boards = $stmt->fetchAll();
        echo json_encode(['success' => true, 'data' => $boards]);
    }
} elseif ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);

    if (isset($_GET['action']) && $_GET['action'] === 'log') {
        // Save routing performance metrics
        $stmt = $pdo->prepare("INSERT INTO routing_logs (board_id, algorithm, nets_total, nets_routed, nodes_explored, conflicts_detected, ripups_performed, total_wire_length_mm, execution_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['board_id'] ?? null,
            $input['algorithm'] ?? 'unknown',
            $input['nets_total'] ?? 0,
            $input['nets_routed'] ?? 0,
            $input['nodes_explored'] ?? 0,
            $input['conflicts_detected'] ?? 0,
            $input['ripups_performed'] ?? 0,
            $input['total_wire_length_mm'] ?? 0.0,
            $input['execution_time_ms'] ?? 0.0
        ]);
        echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
        exit;
    }

    if (empty($input['title']) || !isset($input['components']) || !isset($input['netlist'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Title, components, and netlist are required']);
        exit;
    }

    $title = trim($input['title']);
    $componentsJson = json_encode($input['components']);
    $netlistJson = json_encode($input['netlist']);

    if (isset($input['id']) && !empty($input['id'])) {
        $stmt = $pdo->prepare("UPDATE saved_boards SET title = ?, components_json = ?, netlist_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$title, $componentsJson, $netlistJson, (int)$input['id']]);
        echo json_encode(['success' => true, 'id' => $input['id']]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO saved_boards (title, components_json, netlist_json) VALUES (?, ?, ?)");
        $stmt->execute([$title, $componentsJson, $netlistJson]);
        echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
    }
} elseif ($method === 'DELETE') {
    if (!isset($_GET['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Board ID is required']);
        exit;
    }
    $stmt = $pdo->prepare("DELETE FROM saved_boards WHERE id = ?");
    $stmt->execute([(int)$_GET['id']]);
    echo json_encode(['success' => true]);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
