import React, { memo } from "react";
import { Surface } from "./Surface.jsx";
import { Icon } from "./Icon.jsx";
export const GameLayout = memo(function GameLayout({
  canvasRef,
  hostRef,
  handleClick,
}) {
  return (
    <div id="app" ref={hostRef} onClick={handleClick}>
      <canvas id="gl" ref={canvasRef}></canvas>
      <div id="world"></div>
      <Surface
        className="screen"
        id="scrMenu"
        aria-label="Main menu"
        tag="section"
      >
        <div className="topbar">
          <button
            className="iconBtn teal"
            id="btnSettings"
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.5 7.5 0 0 0-1.7-1L15 3h-4l-.4 2.8a7.5 7.5 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1L11 21h4l.4-2.8c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"></path>
            </svg>
          </button>
          <div className="pill" id="menuCoinPill">
            <i className="coin"></i>
            <span id="menuCoins">{"0"}</span>
          </div>
        </div>
        <div className="logo">
          <div className="l1">{"MAMA PUT"}</div>
          <div className="l2">
            {"RUSH "}
            <span>{"3D"}</span>
          </div>
          <div className="tag">{"From Roadside Buka to Food Empire!"}</div>
        </div>
        <div className="menuBtns">
          <button className="btn big green pulse" id="btnPlay">
            <Icon name="play" />
            <span className="buttonLabel">{"PLAY"}</span>
          </button>
          <div className="row">
            <button className="btn teal" id="btnShop">
              <svg
                viewBox="0 0 24 24"
                fill="#fff"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M3 4h2l2.4 10.2A2 2 0 0 0 9.3 16H18a2 2 0 0 0 1.9-1.4L22 8H6.2L5.6 5.5A2 2 0 0 0 3.7 4H3zm6 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm9 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"></path>
              </svg>
              {"Upgrades"}
            </button>
            <button className="btn coral" id="btnDaily">
              <svg
                viewBox="0 0 24 24"
                fill="#fff"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm-2 8h14v10H5zm7 2l1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z"></path>
              </svg>
              {"Daily"}
            </button>
          </div>
          <button className="btn gold" id="btnEndless">
            <Icon name="infinity" />
            <span className="buttonLabel">
              {"Endless Rush"}
              <span className="lock" id="endlessLock">
                {"Beat Level 50 to unlock"}
              </span>
            </span>
          </button>
        </div>
      </Surface>
      <Surface
        className="screen"
        id="scrMap"
        aria-label="Level map"
        tag="section"
      >
        <div className="mapHead">
          <button className="iconBtn" id="mapBack" aria-label="Back">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M15.5 4 7 12l8.5 8 2-2-6.4-6 6.4-6z"></path>
            </svg>
          </button>
          <h2>{"Your Food Journey"}</h2>
          <div className="pill">
            <i className="coin"></i>
            <span id="mapCoins">{"0"}</span>
          </div>
        </div>
        <div className="mapScroll scroll" id="mapScroll">
          <div className="mapInner" id="mapInner"></div>
        </div>
      </Surface>
      <Surface className="screen" id="scrGame" aria-label="Game" tag="section">
        <div className="hudTop" id="hudTop">
          <div className="hrow">
            <button className="iconBtn" id="btnPause" aria-label="Pause">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <rect x="6" y="5" width="4" height="14" rx="1.5"></rect>
                <rect x="14" y="5" width="4" height="14" rx="1.5"></rect>
              </svg>
            </button>
            <div className="lvlBox">
              <div className="lvlName" id="hudLvl"></div>
              <div className="prog">
                <b id="hudProg"></b>
                <span id="hudProgTxt">{"0 / 5 served"}</span>
              </div>
            </div>
            <div className="pill" id="hudCoinPill">
              <i className="coin"></i>
              <span id="hudCoins">{"0"}</span>
            </div>
          </div>
          <div className="hrow">
            <div className="pill timer" id="hudTimer">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 1h6v2H9zm3 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 9.4V8h-2v6.2l4.3 2.6 1-1.7z"></path>
              </svg>
              <span id="hudTime">{"1:00"}</span>
            </div>
            <div className="starMeter">
              <div className="sbar" id="hudSbar">
                <b id="hudScoreBar"></b>
                <i></i>
                <i></i>
                <i></i>
              </div>
              <span className="score" id="hudScore">
                {"0"}
              </span>
            </div>
            <div className="lives" id="hudLives">
              <i></i>
              <i></i>
              <i></i>
            </div>
          </div>
        </div>
        <div className="combo" id="combo"></div>
        <div className="banner" id="banner">
          <div className="b1"></div>
          <div className="b2"></div>
          <div className="b3"></div>
        </div>
        <div className="foodBar" id="foodBar">
          <div className="foodGrid" id="foodBtns"></div>
        </div>
      </Surface>
      <div id="fx"></div>
      <Surface className="overlay" id="ovPause" tag="div">
        <div className="panel">
          <div className="ribbon">{"Small Break"}</div>
          <p className="sub">
            {"Customers dey wait o. Come back sharp sharp!"}
          </p>
          <div className="pauseList">
            <button className="btn green big" id="pResume">
              <Icon name="play" />
              <span className="buttonLabel">{"Resume"}</span>
            </button>
            <div className="toggle">
              {"Sound effects"}
              <button className="sw" id="pSound" aria-label="Sound effects">
                <Icon name="check" />
              </button>
            </div>
            <div className="toggle">
              {"Music"}
              <button className="sw" id="pMusic" aria-label="Music">
                <Icon name="check" />
              </button>
            </div>
            <div className="btnRow">
              <button className="btn plain" id="pRestart">
                <Icon name="restart" />
                <span className="buttonLabel">{"Restart"}</span>
              </button>
              <button className="btn coral" id="pMenu">
                <Icon name="exit" />
                <span className="buttonLabel">{"Quit"}</span>
              </button>
            </div>
          </div>
        </div>
      </Surface>
      <Surface className="overlay" id="ovWin" tag="div">
        <div className="panel">
          <div className="ribbon" id="winTitle">
            {"Level Complete!"}
          </div>
          <p className="sub" id="winSub">
            {"Omo, this food sweet!"}
          </p>
          <div className="bigstars">
            <i className="bigstar"></i>
            <i className="bigstar"></i>
            <i className="bigstar"></i>
          </div>
          <div className="stats">
            <div className="stat">
              <span>{"Score"}</span>
              <b id="winScore">{"0"}</b>
            </div>
            <div className="stat">
              <span>{"Coins earned"}</span>
              <b>
                <i className="coin"></i>
                <span id="winCoins">{"0"}</span>
              </b>
            </div>
            <div className="stat">
              <span id="winL3">{"Best combo"}</span>
              <b id="winCombo">{"x0"}</b>
            </div>
          </div>
          <div className="btnRow">
            <button className="btn plain" id="winMap">
              <Icon name="map" />
              <span className="buttonLabel">{"Map"}</span>
            </button>
            <button className="btn teal" id="winRetry">
              <Icon name="restart" />
              <span className="buttonLabel">{"Replay"}</span>
            </button>
            <button className="btn green grow pulse" id="winNext">
              <Icon name="next" />
              <span className="buttonLabel">{"Next"}</span>
            </button>
          </div>
        </div>
      </Surface>
      <Surface className="overlay" id="ovFail" tag="div">
        <div className="panel">
          <div className="ribbon" id="failTitle">
            {"Ah! Customers Vex!"}
          </div>
          <div className="failArt" aria-hidden="true">
            {"🍲"}
          </div>
          <p className="sub" id="failSub">
            {"No wahala. Every big madam started small. Try again!"}
          </p>
          <div className="stats">
            <div className="stat">
              <span>{"Served"}</span>
              <b id="failServed">{"0"}</b>
            </div>
          </div>
          <div className="btnRow">
            <button className="btn plain" id="failMap">
              <Icon name="map" />
              <span className="buttonLabel">{"Map"}</span>
            </button>
            <button className="btn green grow pulse" id="failRetry">
              <Icon name="restart" />
              <span className="buttonLabel">{"Try Again"}</span>
            </button>
          </div>
        </div>
      </Surface>
      <Surface className="overlay" id="ovShop" tag="div">
        <div className="panel">
          <div className="shopHead">
            <div className="ribbon small" style={{ margin: "0" }}>
              {"Mama's Shop"}
            </div>
            <div className="pill">
              <i className="coin"></i>
              <span id="shopCoins">{"0"}</span>
            </div>
          </div>
          <div className="tabs">
            <button id="tabUp" className="on">
              <Icon name="upgrade" />
              <span className="buttonLabel">{"Upgrades"}</span>
            </button>
            <button id="tabStyle">
              <Icon name="chef" />
              <span className="buttonLabel">{"Chef & Kitchen"}</span>
            </button>
          </div>
          <div className="shopList scroll" id="shopList"></div>
          <div className="btnRow" style={{ marginTop: "12px" }}>
            <button className="btn coral" id="shopClose">
              <Icon name="close" />
              <span className="buttonLabel">{"Close"}</span>
            </button>
          </div>
        </div>
      </Surface>
      <Surface className="overlay" id="ovSettings" tag="div">
        <div className="panel">
          <div className="ribbon">{"Settings"}</div>
          <div className="pauseList">
            <div className="toggle">
              {"Sound effects"}
              <button className="sw" id="sSound" aria-label="Sound effects">
                <Icon name="check" />
              </button>
            </div>
            <div className="toggle">
              {"Music"}
              <button className="sw" id="sMusic" aria-label="Music">
                <Icon name="check" />
              </button>
            </div>
            <div className="toggle">
              {"High quality graphics"}
              <button
                className="sw"
                id="sQuality"
                aria-label="High quality graphics"
              >
                <Icon name="check" />
              </button>
            </div>
            <button className="btn plain" id="sReset">
              <Icon name="restart" />
              <span className="buttonLabel">{"Reset progress"}</span>
            </button>
            <button className="btn green" id="sClose">
              <Icon name="check" />
              <span className="buttonLabel">{"Done"}</span>
            </button>
          </div>
        </div>
      </Surface>
      <Surface className="overlay" id="ovReward" tag="div">
        <div className="panel">
          <div className="ribbon">{"Daily Reward!"}</div>
          <p className="sub" id="rewardSub">
            {"Welcome back! Day 1 of your streak."}
          </p>
          <div
            style={{ display: "grid", placeItems: "center", margin: "16px 0" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontFamily: "var(--display)",
                fontSize: "44px",
              }}
            >
              <i className="coin" style={{ width: "52px", height: "52px" }}></i>
              <span id="rewardAmt">{"50"}</span>
            </div>
          </div>
          <button
            className="btn gold big pulse"
            id="rewardClaim"
            style={{ width: "100%" }}
          >
            <Icon name="gift" />
            <span className="buttonLabel">{"Collect"}</span>
          </button>
        </div>
      </Surface>
      <Surface className="overlay" id="ovDaily" tag="div">
        <div className="panel">
          <div className="ribbon">{"Daily Challenge"}</div>
          <p className="sub" id="dailySub"></p>
          <div className="mods" id="dailyMods"></div>
          <div className="btnRow">
            <button className="btn plain" id="dailyClose">
              <Icon name="close" />
              <span className="buttonLabel">{"Later"}</span>
            </button>
            <button className="btn green grow pulse" id="dailyGo">
              <Icon name="play" />
              <span className="buttonLabel">{"Play"}</span>
            </button>
          </div>
        </div>
      </Surface>
      <canvas id="confetti"></canvas>
      <div className="toast" id="toast"></div>
      <div id="boot">
        <div className="bx">
          <div className="plate"></div>
          <div id="bootMsg">{"Heating up the jollof pot…"}</div>
        </div>
      </div>
    </div>
  );
});
