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
    Route::get("/me", [MamaputController::class, "me"]);
    Route::patch("/me", [MamaputController::class, "rename"]);
    Route::get("/save", [MamaputController::class, "showSave"]);
    Route::put("/save", [MamaputController::class, "storeSave"]);
    Route::post("/shifts", [MamaputController::class, "shift"]);
    Route::get("/leaderboard", [MamaputController::class, "leaderboard"]);
});
