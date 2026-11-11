<?php

// Appended to routes/api.php on war.kikter.com (with "use App\Http\Controllers\MamaputController;").

// Mama Put Rush (frontend on Vercel). Players use a bearer token from POST /players
// (guest) or from signing in with a Kikter account or Lagos Life.
Route::prefix("mamaput")->middleware("throttle:120,1")->group(function () {
    Route::get("/config", [MamaputController::class, "config"]);
    Route::post("/players", [MamaputController::class, "register"])->middleware("throttle:10,1,mpnew");
    Route::middleware("throttle:10,1,mpauth")->group(function () {
        Route::post("/auth/register", [MamaputController::class, "signUp"]);
        Route::post("/auth/login", [MamaputController::class, "login"]);
    });
    Route::post("/auth/lagoslife", [MamaputController::class, "lagosLife"])->middleware("throttle:30,1,mplagos");
    Route::post("/auth/logout", [MamaputController::class, "logout"]);
    Route::get("/wallet", [MamaputController::class, "wallet"]);
    Route::post("/wallet/exchange", [MamaputController::class, "exchange"])->middleware("throttle:20,1,mpwallet");
    Route::post("/lagoslife/purchase", [MamaputController::class, "purchase"]);
    Route::post("/lagoslife/webhook", [MamaputController::class, "lagosLifeWebhook"]);
    Route::get("/lagoslife/grants", [MamaputController::class, "grants"]);
    Route::post("/lagoslife/grants/ack", [MamaputController::class, "ackGrants"]);
    Route::get("/me", [MamaputController::class, "me"]);
    Route::patch("/me", [MamaputController::class, "rename"]);
    Route::put("/me/email", [MamaputController::class, "saveEmail"])->middleware("throttle:10,1,mpemail");
    Route::get("/inbox", [MamaputController::class, "inbox"]);
    Route::post("/inbox/read", [MamaputController::class, "readInbox"]);
    Route::post("/inbox/{id}/claim", [MamaputController::class, "claimNote"])->whereNumber("id");
    Route::post("/inbox/{id}/mute", [MamaputController::class, "muteNote"])->whereNumber("id");
    Route::post("/inbox/{id}/reply", [MamaputController::class, "replyNote"])->whereNumber("id")->middleware("throttle:10,1,mpreply");
    Route::get("/support", [MamaputController::class, "support"]);
    Route::post("/support/read", [MamaputController::class, "readTickets"]);
    Route::middleware("throttle:6,1,mpsupport")->group(function () {
        Route::post("/support", [MamaputController::class, "createTicket"]);
        Route::post("/support/{id}/reply", [MamaputController::class, "replyTicket"])->whereNumber("id");
    });
    Route::get("/save", [MamaputController::class, "showSave"]);
    Route::put("/save", [MamaputController::class, "storeSave"]);
    Route::post("/shifts", [MamaputController::class, "shift"]);
    Route::get("/leaderboard", [MamaputController::class, "leaderboard"]);
});
