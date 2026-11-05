<?php

namespace App\Filament\Resources\Users;

use App\Filament\Actions\EmailPlayers;
use App\Models\GameProfile;
use App\Models\User;
use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Support\Icons\Heroicon;
use Illuminate\Support\Facades\Auth;

/**
 * Player moderation actions shared by the accounts table and the account page.
 */
class UserActions
{
    public static function sendEmail(): Action
    {
        return Action::make('sendEmail')
            ->label('Send email')
            ->visible(fn (User $record): bool => filled($record->email))
            ->icon(Heroicon::OutlinedEnvelope)
            ->color('primary')
            ->modalSubmitActionLabel('Send email')
            ->schema(EmailPlayers::fields())
            ->action(function (User $record, array $data): void {
                EmailPlayers::send([['email' => $record->email, 'name' => $record->name]], $data['subject'], $data['message'], (string) config('app.name'));
            });
    }

    public static function ban(): Action
    {
        return Action::make('ban')
            ->label('Ban')
            ->icon(Heroicon::OutlinedNoSymbol)
            ->color('danger')
            ->visible(fn (User $record): bool => ! $record->isBanned() && $record->isNot(Auth::user()))
            ->modalDescription('The player is signed out immediately and cannot log in or play online until unbanned.')
            ->schema([
                TextInput::make('reason')->required()->maxLength(255)->placeholder('e.g. Cheating in ranked'),
            ])
            ->action(function (User $record, array $data): void {
                $record->forceFill(['banned_at' => now(), 'ban_reason' => $data['reason']])->save();
                Notification::make()->title("{$record->name} has been banned")->danger()->send();
            });
    }

    public static function unban(): Action
    {
        return Action::make('unban')
            ->label('Unban')
            ->icon(Heroicon::OutlinedCheckCircle)
            ->color('success')
            ->visible(fn (User $record): bool => $record->isBanned())
            ->requiresConfirmation()
            ->action(function (User $record): void {
                $record->forceFill(['banned_at' => null, 'ban_reason' => null])->save();
                Notification::make()->title("{$record->name} can play again")->success()->send();
            });
    }

    public static function toggleAdmin(): Action
    {
        return Action::make('toggleAdmin')
            ->label(fn (User $record): string => $record->is_admin ? 'Remove admin' : 'Make admin')
            ->icon(Heroicon::OutlinedShieldCheck)
            ->color('warning')
            ->visible(fn (User $record): bool => $record->isNot(Auth::user()))
            ->requiresConfirmation()
            ->action(function (User $record): void {
                $record->forceFill(['is_admin' => ! $record->is_admin])->save();
                Notification::make()->title($record->is_admin ? "{$record->name} is now an admin" : "{$record->name} is no longer an admin")->success()->send();
            });
    }

    public static function grantXp(): Action
    {
        return Action::make('grantXp')
            ->label('Grant XP')
            ->icon(Heroicon::OutlinedGift)
            ->color('info')
            ->schema([
                TextInput::make('amount')->numeric()->required()->integer()->minValue(-100000)->maxValue(100000)
                    ->helperText('Use a negative number to remove XP.'),
            ])
            ->action(function (User $record, array $data): void {
                $profile = GameProfile::firstOrCreate(['user_id' => $record->id]);
                $profile->xp = max(0, $profile->xp + (int) $data['amount']);
                $profile->save();
                Notification::make()->title("{$record->name} now has {$profile->xp} XP")->success()->send();
            });
    }
}
