<?php

namespace App\Filament\Resources\Users\Schemas;

use App\Models\User;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Illuminate\Support\Facades\Hash;

class UserForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Account')
                    ->description('Name, sign-in email and password.')
                    ->columns(2)
                    ->schema([
                        TextInput::make('name')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('email')
                            ->label('Email address')
                            ->email()
                            ->required(fn (?User $record): bool => ! $record || filled($record->email))
                            ->helperText('Lagos Life does not share an email. Leave blank for these accounts.')
                            ->dehydrateStateUsing(fn (?string $state): ?string => filled($state) ? mb_strtolower(trim($state)) : null)
                            ->unique(ignoreRecord: true)
                            ->maxLength(255),
                        TextInput::make('password')
                            ->password()
                            ->revealable()
                            ->minLength(8)
                            ->required(fn (string $operation): bool => $operation === 'create')
                            ->dehydrated(fn (?string $state): bool => filled($state))
                            ->dehydrateStateUsing(fn (string $state): string => Hash::make($state))
                            ->helperText('Leave blank to keep the current password.'),
                        DateTimePicker::make('email_verified_at')
                            ->label('Email verified at'),
                    ]),
                Section::make('Access')
                    ->description('Admins can open this panel. Banned players are signed out and blocked from online play.')
                    ->columns(2)
                    ->schema([
                        Toggle::make('is_admin')
                            ->label('Administrator')
                            ->helperText('Can manage the games from this panel.'),
                        DateTimePicker::make('banned_at')
                            ->label('Banned at'),
                        TextInput::make('ban_reason')
                            ->maxLength(255)
                            ->columnSpanFull(),
                    ]),
            ]);
    }
}
