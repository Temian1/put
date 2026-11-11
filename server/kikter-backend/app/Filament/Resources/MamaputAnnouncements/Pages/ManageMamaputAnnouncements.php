<?php

namespace App\Filament\Resources\MamaputAnnouncements\Pages;

use App\Filament\Resources\MamaputAnnouncements\MamaputAnnouncementResource;
use App\MamaputInbox;
use App\Models\User;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;
use Illuminate\Database\Eloquent\Model;

class ManageMamaputAnnouncements extends ManageRecords
{
    protected static string $resource = MamaputAnnouncementResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()
                ->label('New announcement')
                ->modalSubmitActionLabel('Send')
                ->createAnother(false)
                ->successNotificationTitle('Announcement sent')
                ->using(function (array $data): Model {
                    /** @var User|null $admin */
                    $admin = auth()->user();

                    return MamaputInbox::announce($data, $admin);
                }),
        ];
    }
}
