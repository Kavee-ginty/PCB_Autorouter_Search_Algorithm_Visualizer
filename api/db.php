<?php
/**
 * db.php - Database connection and auto-initialization for SQLite
 */

header('Content-Type: application/json; charset=utf-8');

$dbDir = __DIR__ . '/../database';
if (!is_dir($dbDir)) {
    mkdir($dbDir, 0777, true);
}

$dbPath = $dbDir . '/pcb_autoroute.sqlite';
$isNewDb = !file_exists($dbPath);

try {
    $pdo = new PDO("sqlite:" . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Auto-create schema if first run
    if ($isNewDb) {
        $schemaFile = $dbDir . '/schema.sql';
        if (file_exists($schemaFile)) {
            $sql = file_get_contents($schemaFile);
            $pdo->exec($sql);
        }
        seedDefaultPresets($pdo);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

function seedDefaultPresets($pdo) {
    // Default Circuit: Automatic Light-Activated LED Circuit
    // Components: Battery (B+, B-), Switch S1 (S1-A, S1-B), RLDR (L-in, L-out), Resistor R1 (R-in, R-out), LED D1 (D-A, D-K)
    $presets = [
        [
            'name' => 'Automatic Night Light Circuit (Default)',
            'description' => 'Standard series loop connecting Battery -> Switch -> Light Sensor (LDR) -> Current Limiting Resistor -> LED -> Battery Ground.',
            'circuit_type' => 'series',
            'components_json' => json_encode([
                [
                    'id' => 'bat_1',
                    'type' => 'battery',
                    'name' => 'Battery (BT1)',
                    'x' => 1,
                    'y' => 1,
                    'orientation' => 'horizontal',
                    'pins' => [
                        ['id' => 'B+', 'label' => '+', 'x' => 1, 'y' => 1, 'type' => 'power'],
                        ['id' => 'B-', 'label' => '-', 'x' => 3, 'y' => 1, 'type' => 'ground']
                    ]
                ],
                [
                    'id' => 'sw_1',
                    'type' => 'switch',
                    'name' => 'Power Switch (S1)',
                    'x' => 5,
                    'y' => 1,
                    'orientation' => 'horizontal',
                    'pins' => [
                        ['id' => 'S1-A', 'label' => '+', 'x' => 5, 'y' => 1, 'type' => 'signal'],
                        ['id' => 'S1-B', 'label' => '-', 'x' => 6, 'y' => 1, 'type' => 'signal']
                    ]
                ],
                [
                    'id' => 'ldr_1',
                    'type' => 'sensor',
                    'name' => 'Light Sensor (RLDR)',
                    'x' => 8,
                    'y' => 3,
                    'orientation' => 'vertical',
                    'pins' => [
                        ['id' => 'L-in', 'label' => '+', 'x' => 8, 'y' => 3, 'type' => 'signal'],
                        ['id' => 'L-out', 'label' => '-', 'x' => 8, 'y' => 4, 'type' => 'signal']
                    ]
                ],
                [
                    'id' => 'res_1',
                    'type' => 'resistor',
                    'name' => 'Current Resistor (R1)',
                    'x' => 5,
                    'y' => 6,
                    'orientation' => 'horizontal',
                    'pins' => [
                        ['id' => 'R-in', 'label' => '', 'x' => 5, 'y' => 6, 'type' => 'signal'],
                        ['id' => 'R-out', 'label' => '', 'x' => 6, 'y' => 6, 'type' => 'signal']
                    ]
                ],
                [
                    'id' => 'led_1',
                    'type' => 'led',
                    'name' => 'Indicator LED (D1)',
                    'x' => 1,
                    'y' => 5,
                    'orientation' => 'vertical',
                    'pins' => [
                        ['id' => 'D-A', 'label' => '+', 'x' => 1, 'y' => 5, 'type' => 'anode'],
                        ['id' => 'D-K', 'label' => '-', 'x' => 1, 'y' => 6, 'type' => 'cathode']
                    ]
                ]
            ]),
            'netlist_json' => json_encode([
                ['id' => 'net_1', 'name' => 'Net 1 (VCC)', 'source' => 'B+', 'target' => 'S1-A', 'color' => '#ef4444'],
                ['id' => 'net_2', 'name' => 'Net 2 (Switched)', 'source' => 'S1-B', 'target' => 'L-in', 'color' => '#f59e0b'],
                ['id' => 'net_3', 'name' => 'Net 3 (Sensor Out)', 'source' => 'L-out', 'target' => 'R-in', 'color' => '#10b981'],
                ['id' => 'net_4', 'name' => 'Net 4 (LED Anode)', 'source' => 'R-out', 'target' => 'D-A', 'color' => '#3b82f6'],
                ['id' => 'net_5', 'name' => 'Net 5 (GND Return)', 'source' => 'D-K', 'target' => 'B-', 'color' => '#8b5cf6']
            ])
        ],
        [
            'name' => 'Dense Routing Benchmark',
            'description' => 'Compact placement in center with narrow corridors to test shortest path algorithms.',
            'circuit_type' => 'dense',
            'components_json' => json_encode([
                [
                    'id' => 'bat_1',
                    'type' => 'battery',
                    'name' => 'Battery (BT1)',
                    'x' => 2,
                    'y' => 2,
                    'orientation' => 'horizontal',
                    'pins' => [
                        ['id' => 'B+', 'label' => '+', 'x' => 2, 'y' => 2, 'type' => 'power'],
                        ['id' => 'B-', 'label' => '-', 'x' => 4, 'y' => 2, 'type' => 'ground']
                    ]
                ],
                [
                    'id' => 'sw_1',
                    'type' => 'switch',
                    'name' => 'Power Switch (S1)',
                    'x' => 6,
                    'y' => 2,
                    'orientation' => 'horizontal',
                    'pins' => [
                        ['id' => 'S1-A', 'label' => '+', 'x' => 6, 'y' => 2, 'type' => 'signal'],
                        ['id' => 'S1-B', 'label' => '-', 'x' => 7, 'y' => 2, 'type' => 'signal']
                    ]
                ],
                [
                    'id' => 'ldr_1',
                    'type' => 'sensor',
                    'name' => 'Light Sensor (RLDR)',
                    'x' => 6,
                    'y' => 4,
                    'orientation' => 'vertical',
                    'pins' => [
                        ['id' => 'L-in', 'label' => '+', 'x' => 6, 'y' => 4, 'type' => 'signal'],
                        ['id' => 'L-out', 'label' => '-', 'x' => 6, 'y' => 5, 'type' => 'signal']
                    ]
                ],
                [
                    'id' => 'res_1',
                    'type' => 'resistor',
                    'name' => 'Current Resistor (R1)',
                    'x' => 4,
                    'y' => 5,
                    'orientation' => 'horizontal',
                    'pins' => [
                        ['id' => 'R-in', 'label' => '', 'x' => 4, 'y' => 5, 'type' => 'signal'],
                        ['id' => 'R-out', 'label' => '', 'x' => 5, 'y' => 5, 'type' => 'signal']
                    ]
                ],
                [
                    'id' => 'led_1',
                    'type' => 'led',
                    'name' => 'Indicator LED (D1)',
                    'x' => 2,
                    'y' => 4,
                    'orientation' => 'vertical',
                    'pins' => [
                        ['id' => 'D-A', 'label' => '+', 'x' => 2, 'y' => 4, 'type' => 'anode'],
                        ['id' => 'D-K', 'label' => '-', 'x' => 2, 'y' => 5, 'type' => 'cathode']
                    ]
                ]
            ]),
            'netlist_json' => json_encode([
                ['id' => 'net_1', 'name' => 'Net 1 (VCC)', 'source' => 'B+', 'target' => 'S1-A', 'color' => '#ef4444'],
                ['id' => 'net_2', 'name' => 'Net 2 (Switched)', 'source' => 'S1-B', 'target' => 'L-in', 'color' => '#f59e0b'],
                ['id' => 'net_3', 'name' => 'Net 3 (Sensor Out)', 'source' => 'L-out', 'target' => 'R-in', 'color' => '#10b981'],
                ['id' => 'net_4', 'name' => 'Net 4 (LED Anode)', 'source' => 'R-out', 'target' => 'D-A', 'color' => '#3b82f6'],
                ['id' => 'net_5', 'name' => 'Net 5 (GND Return)', 'source' => 'D-K', 'target' => 'B-', 'color' => '#8b5cf6']
            ])
        ],
        [
            'name' => 'Rip-Up & Reroute Challenge',
            'description' => 'Cross-configured pins that trigger trace conflicts, demonstrating automated deadlock rip-up & reroute logic.',
            'circuit_type' => 'challenge',
            'components_json' => json_encode([
                [
                    'id' => 'bat_1',
                    'type' => 'battery',
                    'name' => 'Battery (BT1)',
                    'x' => 1,
                    'y' => 2,
                    'orientation' => 'horizontal',
                    'pins' => [
                        ['id' => 'B+', 'label' => '+', 'x' => 1, 'y' => 2, 'type' => 'power'],
                        ['id' => 'B-', 'label' => '-', 'x' => 3, 'y' => 2, 'type' => 'ground']
                    ]
                ],
                [
                    'id' => 'sw_1',
                    'type' => 'switch',
                    'name' => 'Power Switch (S1)',
                    'x' => 7,
                    'y' => 5,
                    'orientation' => 'horizontal',
                    'pins' => [
                        ['id' => 'S1-A', 'label' => '+', 'x' => 7, 'y' => 5, 'type' => 'signal'],
                        ['id' => 'S1-B', 'label' => '-', 'x' => 8, 'y' => 5, 'type' => 'signal']
                    ]
                ],
                [
                    'id' => 'ldr_1',
                    'type' => 'sensor',
                    'name' => 'Light Sensor (RLDR)',
                    'x' => 7,
                    'y' => 1,
                    'orientation' => 'horizontal',
                    'pins' => [
                        ['id' => 'L-in', 'label' => '+', 'x' => 7, 'y' => 1, 'type' => 'signal'],
                        ['id' => 'L-out', 'label' => '-', 'x' => 8, 'y' => 1, 'type' => 'signal']
                    ]
                ],
                [
                    'id' => 'res_1',
                    'type' => 'resistor',
                    'name' => 'Current Resistor (R1)',
                    'x' => 1,
                    'y' => 5,
                    'orientation' => 'horizontal',
                    'pins' => [
                        ['id' => 'R-in', 'label' => '', 'x' => 1, 'y' => 5, 'type' => 'signal'],
                        ['id' => 'R-out', 'label' => '', 'x' => 2, 'y' => 5, 'type' => 'signal']
                    ]
                ],
                [
                    'id' => 'led_1',
                    'type' => 'led',
                    'name' => 'Indicator LED (D1)',
                    'x' => 4,
                    'y' => 3,
                    'orientation' => 'horizontal',
                    'pins' => [
                        ['id' => 'D-A', 'label' => '+', 'x' => 4, 'y' => 3, 'type' => 'anode'],
                        ['id' => 'D-K', 'label' => '-', 'x' => 5, 'y' => 3, 'type' => 'cathode']
                    ]
                ]
            ]),
            'netlist_json' => json_encode([
                ['id' => 'net_1', 'name' => 'Net 1 (VCC Cross)', 'source' => 'B+', 'target' => 'S1-A', 'color' => '#ef4444'],
                ['id' => 'net_2', 'name' => 'Net 2 (Sensor Cross)', 'source' => 'S1-B', 'target' => 'L-in', 'color' => '#f59e0b'],
                ['id' => 'net_3', 'name' => 'Net 3 (Sensor Out)', 'source' => 'L-out', 'target' => 'R-in', 'color' => '#10b981'],
                ['id' => 'net_4', 'name' => 'Net 4 (LED Anode)', 'source' => 'R-out', 'target' => 'D-A', 'color' => '#3b82f6'],
                ['id' => 'net_5', 'name' => 'Net 5 (GND Return)', 'source' => 'D-K', 'target' => 'B-', 'color' => '#8b5cf6']
            ])
        ]
    ];

    $stmt = $pdo->prepare("INSERT INTO presets (name, description, circuit_type, components_json, netlist_json) VALUES (?, ?, ?, ?, ?)");
    foreach ($presets as $p) {
        $stmt->execute([$p['name'], $p['description'], $p['circuit_type'], $p['components_json'], $p['netlist_json']]);
    }
}
