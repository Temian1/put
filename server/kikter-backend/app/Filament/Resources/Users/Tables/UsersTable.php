<?php

namespace App\Filament\Resources\Users\Tables;

use App\Filament\Actions\EmailPlayers;
use App\Filament\Resources\Users\UserActions;
use App\Models\User;
use Filament\Actions\ActionGroup;
use Filament\Actions\BulkAction;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;

class UsersTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query) => $query->with('gameProfile'))
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('name')
                    ->searchable()
                    ->sortable()
                    ->weight('bold')
                    ->description(fn (User $record): string => $record->email ?? 'Lagos Life · email not shared'),
                TextColumn::make('status')
                    ->state(fn (User $record): string => $record->isBanned() ? 'Banned' : 'Active')
                    ->badge()
                    ->color(fn (string $state): string => $state === 'Banned' ? 'danger' : 'success')
                    ->tooltip(fn (User $record): ?string => $record->ban_reason),
                IconColumn::make('is_admin')
                    ->label('Admin')
                    ->boolean(),
                TextColumn::make('gameProfile.xp')
                    ->label('XP')
                    ->numeric()
                    ->placeholder('0'),
                TextColumn::make('gameProfile.rating')
                    ->label('Rating')
                    ->placeholder('1000'),
                TextColumn::make('gameProfile.slasher_best')
                    ->label('Slasher best')
                    ->placeholder('0'),
                TextColumn::make('email_verified_at')
                    ->label('Verified')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('created_at')
                    ->label('Joined')
                    ->since()
                    ->sortable(),
            ])
            ->filters([
                TernaryFilter::make('is_admin')->label('Administrators'),
                TernaryFilter::make('banned')
                    ->label('Banned')
                    ->queries(
                        true: fn (Builder $query) => $query->whereNotNull('banned_at'),
                        false: fn (Builder $query) => $query->whereNull('banned_at'),
                    ),
            ])
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
                ActionGroup::make([
                    UserActions::sendEmail(),
                    UserActions::grantXp(),
                    UserActions::toggleAdmin(),
                    UserActions::ban(),
                    UserActions::unban(),
                ]),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    BulkAction::make('sendEmail')
                        ->label('Email selected')
                        ->icon(Heroicon::OutlinedEnvelope)
                        ->modalSubmitActionLabel('Send email')
                        ->schema(EmailPlayers::fields())
                        ->deselectRecordsAfterCompletion()
                        ->action(fn (Collection $records, array $data) => EmailPlayers::send(
                            $records->map(fn (User $user): array => ['email' => $user->email, 'name' => $user->name]),
                            $data['subject'], $data['message'], (string) config('app.name'),
                        )),
                    BulkAction::make('ban')
                        ->label('Ban selected')
                        ->icon(Heroicon::OutlinedNoSymbol)
                        ->color('danger')
                        ->requiresConfirmation()
                        ->action(fn (Collection $records) => $records
                            ->reject(fn (User $user): bool => $user->is(Auth::user()))
                            ->each(fn (User $user) => $user->forceFill(['banned_at' => now(), 'ban_reason' => 'Bulk ban'])->save())),
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
