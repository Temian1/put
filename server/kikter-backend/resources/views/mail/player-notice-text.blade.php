Hi {!! $playerName !!},

{!! $body !!}

The {!! $team !!} team
@if($actionUrl)

{!! $actionLabel !!}: {!! $actionUrl !!}
@endif
@if($preferencesUrl)

Stop game reminder emails: {!! $preferencesUrl !!}
@endif
