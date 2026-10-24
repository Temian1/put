<?php

namespace App\Filament;

use Filament\Support\Contracts\HasLabel;

/**
 * Admin sidebar sections, in display order.
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
            self::Players => 'Players',
            self::Matches => 'Matches',
            self::GameControl => 'Game control',
            self::MamaPut => 'Mama Put Rush',
        };
    }
}
