<?php

/*
 * Mama Put Rush on Lagos Life (Vatar). Used when Mama Put is its own Lagos
 * Life game and the keys have not been saved in the admin (Mama Put Rush →
 * Settings → Accounts & Lagos Life), which takes precedence.
 */
return [
    'vatar' => [
        'mode' => env('MAMAPUT_VATAR_MODE', 'test'),
        'secret' => env('MAMAPUT_VATAR_SECRET'),
        'webhook_secret' => env('MAMAPUT_VATAR_WEBHOOK_SECRET'),
        'results_secret' => env('MAMAPUT_VATAR_RESULTS_SECRET'),
    ],
];
