import React, { useCallback, useEffect, useRef } from "react";
import { createGameStore } from "./store/gameStore.js";
import { GameLayout } from "./ui/GameLayout.jsx";
import { StoreContext } from "./ui/Surface.jsx";
import { createUiBridge, PortalLayer } from "./ui/bridge.jsx";

export default function App() {
  const canvasRef = useRef(null),
    hostRef = useRef(null),
    bridgeRef = useRef(null);
  const storeRef = useRef(null);
  if (!storeRef.current) storeRef.current = createGameStore();
  const handleClick = useCallback(
    (event) => bridgeRef.current?.handleClick(event),
    [],
  );
  useEffect(() => {
    let cancelled = false,
      dispose;
    const bridge = createUiBridge(storeRef.current, hostRef.current);
    bridgeRef.current = bridge;
    // Import failure keeps a usable loading error, even when the engine chunk cannot load.
    import("./engine/SceneManager.js")
      .then(({ mountGame }) => {
        if (!cancelled)
          dispose = mountGame(canvasRef.current, hostRef.current, bridge);
      })
      .catch((error) => {
        if (!cancelled)
          hostRef.current.querySelector("#bootMsg").textContent =
            "Could not load the 3D engine. Check your connection and reload. " +
            error.message;
      });
    return () => {
      cancelled = true;
      dispose?.();
      bridge.dispose();
      bridgeRef.current = null;
    };
  }, []);
  return (
    <StoreContext.Provider value={storeRef.current}>
      <GameLayout
        canvasRef={canvasRef}
        hostRef={hostRef}
        handleClick={handleClick}
      />
      <PortalLayer store={storeRef.current} />
    </StoreContext.Provider>
  );
}
