<?php

namespace App\Filament\Resources\MamaputAirtime\Pages;

use App\Filament\Resources\MamaputAirtime\MamaputAirtimeResource;
use App\MamaputAirtime;
use App\Models\MamaputAirtimeEntry;
use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ManageRecords;
use Filament\Support\Icons\Heroicon;

class ManageMamaputAirtime extends ManageRecords
{
    protected static string $resource = MamaputAirtimeResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('pickWinners')
                ->label('Pick winners at random')
                ->icon(Heroicon::OutlinedSparkles)
                ->modalDescription('Chooses at random from waiting entries whose players reached level '.MamaputAirtime::LEVEL.' and are not banned. They are marked "Picked to win"; mark each one as sent after sending the airtime.')
                ->modalSubmitActionLabel('Pick')
                ->schema([
                    TextInput::make('count')->label('How many winners')->integer()->minValue(1)->maxValue(100)->default(5)->required(),
                ])
                ->action(function (array $data): void {
                    $winners = MamaputAirtimeEntry::query()->where('status', 'pending')
                        ->whereHas('player', fn ($p) => $p->where('unlocked', '>=', MamaputAirtime::LEVEL)->whereNull('banned_at'))
                        ->inRandomOrder()->limit((int) $data['count'])->get();
                    $winners->each(fn (MamaputAirtimeEntry $e) => $e->forceFill(['status' => 'picked'])->save());
                    Notification::make()
                        ->title($winners->isEmpty() ? 'Nobody to pick yet' : $winners->count().' picked to win')
                        ->body($winners->isEmpty()
                            ? 'No waiting entries have reached level '.MamaputAirtime::LEVEL.'.'
                            : $winners->map(fn (MamaputAirtimeEntry $e): string => $e->player->name.' · '.$e->phone)->implode("\n"))
                        ->status($winners->isEmpty() ? 'warning' : 'success')->persistent()->send();
                }),
        ];
    }
}
