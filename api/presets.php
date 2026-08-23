<?php
/**
 * presets.php - API endpoint for retrieving PCB circuit presets
 */

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (isset($_GET['id'])) {
        $stmt = $pdo->prepare("SELECT * FROM presets WHERE id = ?");
        $stmt->execute([(int)$_GET['id']]);
        $preset = $stmt->fetch();
        if ($preset) {
            $preset['components'] = json_decode($preset['components_json'], true);
            $preset['netlist'] = json_decode($preset['netlist_json'], true);
            echo json_encode(['success' => true, 'data' => $preset]);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Preset not found']);
        }
    } else {
        $stmt = $pdo->query("SELECT id, name, description, circuit_type, components_json, netlist_json, created_at FROM presets ORDER BY id ASC");
        $presets = $stmt->fetchAll();
        foreach ($presets as &$p) {
            $p['components'] = json_decode($p['components_json'], true);
            $p['netlist'] = json_decode($p['netlist_json'], true);
        }
        echo json_encode(['success' => true, 'data' => $presets]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
