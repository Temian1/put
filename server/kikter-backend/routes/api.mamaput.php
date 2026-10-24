<?php

// Appended to routes/api.php on war.kikter.com (with "use App\Http\Controllers\MamaputController;").

// Mama Put Rush (frontend on Vercel). Players use a bearer token from POST /players.
Route::prefix("mamaput")->middleware("throttle:120,1")->group(function () {
    Route::get("/config", [MamaputController::class, "config"]);
    Route::post("/players", [MamaputController::class, "register"])->middleware("throttle:10,1");
    Route::get("/me", [MamaputController::class, "me"]);
    Route::patch("/me", [MamaputController::class, "rename"]);
    Route::get("/save", [MamaputController::class, "showSave"]);
    Route::put("/save", [MamaputController::class, "storeSave"]);
    Route::post("/shifts", [MamaputController::class, "shift"]);
    Route::get("/leaderboard", [MamaputController::class, "leaderboard"]);
});
