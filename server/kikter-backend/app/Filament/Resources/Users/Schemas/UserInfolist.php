<?php

namespace App\Filament\Resources\Users\Schemas;

use App\Models\User;
use Filament\Infolists\Components\IconEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class UserInfolist
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Account')
                    ->columns(3)
                    ->schema([
                        TextEntry::make('name'),
                        TextEntry::make('email')->label('Email address')->placeholder('Not shared by Lagos Life')->copyable(),
                        TextEntry::make('created_at')->label('Joined')->since(),
                        IconEntry::make('is_admin')->label('Administrator')->boolean(),
                        TextEntry::make('status')
                            ->state(fn (User $record): string => $record->isBanned() ? 'Banned' : 'Active')
                            ->badge()
                            ->color(fn (string $state): string => $state === 'Banned' ? 'danger' : 'success'),
                        TextEntry::make('ban_reason')->placeholder('-'),
                    ]),
                Section::make('Lagos War')
                    ->columns(4)
                    ->schema([
                        TextEntry::make('gameProfile.xp')->label('XP')->numeric()->placeholder('0'),
                        TextEntry::make('gameProfile.rating')->label('Rating')->placeholder('1000'),
                        TextEntry::make('gameProfile.wins')->label('Wins')->placeholder('0'),
                        TextEntry::make('gameProfile.matches')->label('Matches')->placeholder('0'),
                        TextEntry::make('gameProfile.blocks')->label('Blocks broken')->placeholder('0'),
                        TextEntry::make('gameProfile.eliminations')->label('Eliminations')->placeholder('0'),
                        TextEntry::make('gameProfile.best_streak')->label('Best streak')->placeholder('0'),
                        TextEntry::make('gameProfile.daily_streak')->label('Daily streak')->placeholder('0'),
                    ]),
                Section::make('Slasher')
                    ->columns(4)
                    ->schema([
                        TextEntry::make('gameProfile.slasher_best')->label('Best score')->placeholder('0'),
                        TextEntry::make('gameProfile.slasher_wins')->label('Wins')->placeholder('0'),
                        TextEntry::make('gameProfile.slasher_matches')->label('Matches')->placeholder('0'),
                        TextEntry::make('gameProfile.slasher_slices')->label('Slices')->placeholder('0'),
                    ]),
            ]);
    }
}
