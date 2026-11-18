<?php

namespace App;

/**
 * Nigerian mobile numbers for airtime rewards: the same rules as the game's
 * src/game/airtime.js. A ported number keeps its old prefix, so the network
 * the player picks is kept even when it differs from our guess.
 */
class MamaputAirtime
{
    public const NETWORKS = ['mtn' => 'MTN', 'airtel' => 'Airtel', 'glo' => 'Glo', '9mobile' => '9mobile'];

    /** The level a player must reach to be in the airtime draw. */
    public const LEVEL = 55;

    private const PREFIXES = [
        'mtn' => ['07025', '07026', '0703', '0704', '0706', '0803', '0806', '0810', '0813', '0814', '0816', '0903', '0906', '0913', '0916'],
        'airtel' => ['0701', '0708', '0802', '0808', '0812', '0901', '0902', '0904', '0907', '0911', '0912'],
        'glo' => ['0705', '0805', '0807', '0811', '0815', '0905', '0915'],
        '9mobile' => ['0809', '0817', '0818', '0908', '0909'],
    ];

    /** "+234 803 123 4567" and "8031234567" become "08031234567"; anything else is null. */
    public static function normalize(?string $raw): ?string
    {
        $d = preg_replace('/[\s\-().]/', '', (string) $raw);
        $d = ltrim((string) $d, '+');
        if (str_starts_with($d, '234')) {
            $d = '0'.substr($d, 3);
        } elseif (preg_match('/^[789]\d{9}$/', $d)) {
            $d = '0'.$d;
        }

        return preg_match('/^0[789][01]\d{8}$/', $d) ? $d : null;
    }

    public static function detect(string $phone): ?string
    {
        foreach ([5, 4] as $length) {
            foreach (self::PREFIXES as $network => $prefixes) {
                foreach ($prefixes as $prefix) {
                    if (strlen($prefix) === $length && str_starts_with($phone, $prefix)) {
                        return $network;
                    }
                }
            }
        }

        return null;
    }
}
