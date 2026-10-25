<?php

namespace App\Filament;

use Filament\Support\Contracts\HasLabel;

/**
 * Admin sidebar sections, in display order. Each label names its game, so
 * Lagos War (Block Battle) and Mama Put Rush settings are never mixed up.
 */
enum NavigationGroup implements HasLabel
{
    case Players;

    case Matches;

    case GameControl;

    case MamaPut;

    public function getLabel(): string
    {
        return match ($this) {
            self::Players => 'Lagos War · Players',
            self::Matches => 'Lagos War · Matches',
            self::GameControl => 'Lagos War · Game control',
            self::MamaPut => 'Mama Put Rush (separate game)',
        };
    }
}
