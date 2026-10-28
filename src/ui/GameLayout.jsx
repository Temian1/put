import React, { memo } from "react";
import { Surface } from "./Surface.jsx";
import { Icon } from "./Icon.jsx";

function Toggle({ id, label }) {
  return (
    <div className="toggle">
      {label}
      <button className="sw" id={id} aria-label={label}>
        <Icon name="check" />
      </button>
    </div>
  );
}

function CashPill({ id, pillId }) {
  return (
    <div className="pill" id={pillId}>
      <i className="note"></i>
      <span id={id}>{"₦0"}</span>
    </div>
  );
}

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
          <button
            className="iconBtn plum accountBtn"
            id="btnAccount"
            aria-label="Account and coins"
          >
            <Icon name="user" />
            <span className="dot" id="accountDot" hidden></span>
          </button>
          <div className="topRight">
            <div className="pill repPill" id="repPill" aria-label="Reputation">
              <svg className="repStar" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" />
              </svg>
              <span id="menuRep">{"50"}</span>
            </div>
            <div className="cashGroup">
              <CashPill id="menuCoins" pillId="menuCoinPill" />
              <button
                className="plusBtn"
                id="btnShop"
                aria-label="Upgrades and shop"
              >
                <Icon name="upgrade" />
              </button>
            </div>
          </div>
        </div>
        <div className="announce" id="announce" hidden></div>
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
            <button className="btn teal" id="btnBoard">
              <Icon name="trophy" />
              <span className="buttonLabel">{"Leaderboard"}</span>
            </button>
            <button className="btn coral" id="btnDaily">
              <Icon name="gift" />
              <span className="buttonLabel">{"Daily"}</span>
            </button>
          </div>
          <div className="row four">
            <button className="btn plain" id="btnMarket">
              <Icon name="basket" />
              <span className="buttonLabel">{"Market"}</span>
            </button>
            <button className="btn plain" id="btnMissions">
              <Icon name="target" />
              <span className="buttonLabel">{"Missions"}</span>
              <span className="badge" id="missionBadge" hidden></span>
            </button>
            <button className="btn plain" id="btnStaff">
              <Icon name="staff" />
              <span className="buttonLabel">{"Staff"}</span>
              <span className="badge cash" id="staffBadge" hidden></span>
            </button>
            <button className="btn plain" id="btnGrow">
              <Icon name="map" />
              <span className="buttonLabel">{"Grow"}</span>
              <span className="badge cash" id="growBadge" hidden></span>
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
          <div className="mapTitle">
            <h2>{"Your Food Journey"}</h2>
            <span className="mapStars">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" />
              </svg>
              <span id="mapStarCount">{"0 / 150"}</span>
            </span>
          </div>
          <CashPill id="mapCoins" />
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
            <CashPill id="hudCoins" pillId="hudCoinPill" />
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
        <div className="rail" id="rail">
          <div className="boost hyg" id="hygiene" aria-label="Hygiene">
            <Icon name="wash" />
            <b id="hygTxt">{"80"}</b>
          </div>
          <button className="boost zoom" id="zoomIn" aria-label="Zoom in">
            <Icon name="zoomIn" />
          </button>
          <button className="boost zoom" id="zoomOut" aria-label="Zoom out">
            <Icon name="zoomOut" />
          </button>
          <button
            className="boost zoom"
            id="camCenter"
            aria-label="Centre the view"
            hidden
          >
            <Icon name="target" />
          </button>
          <button className="boost" id="bFreeze" aria-label="Freeze Time">
            <Icon name="freeze" />
            <b>0</b>
          </button>
          <button className="boost" id="bAuto" aria-label="Auto-Serve">
            <Icon name="bell" />
            <b>0</b>
          </button>
          <button className="boost" id="bCalm" aria-label="Patience Boost">
            <Icon name="heart" />
            <b>0</b>
          </button>
          <button
            className="boost wash"
            id="btnWash"
            hidden
            aria-label="Wash plates"
          >
            <Icon name="wash" />
            <b id="washTxt">{"0"}</b>
            <i id="washBar"></i>
          </button>
        </div>
        <div className="notify" id="notify" aria-live="polite"></div>
        <div className="orders" id="orders"></div>
        <div className="foodBar" id="foodBar">
          <div className="foodGrid" id="foodBtns"></div>
        </div>
        <div className="freezeFx" id="freezeFx"></div>
      </Surface>
      <div id="fx"></div>
      <div id="hand" hidden aria-hidden="true">
        <svg viewBox="0 0 48 48">
          <path d="M18 24V9a3 3 0 0 1 6 0v12l1-1a3 3 0 0 1 5 1 3 3 0 0 1 5 1 3 3 0 0 1 5 2v9c0 7-5 12-12 12h-2c-4 0-7-2-9-5l-6-9a3 3 0 0 1 5-4z" />
        </svg>
      </div>
      <Surface className="overlay scroll" id="ovPause" tag="div">
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
            <Toggle id="pSound" label="Sound effects" />
            <Toggle id="pMusic" label="Music" />
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
      <Surface className="overlay scroll" id="ovWin" tag="div">
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
              <span>{"Sales"}</span>
              <b id="winScore">{"₦0"}</b>
            </div>
            <div className="ledger" id="winLedger"></div>
            <div className="insights" id="winInsights" hidden></div>
            <div className="stat">
              <span>{"Cash in hand"}</span>
              <b>
                <i className="note"></i>
                <span id="winCoins">{"₦0"}</span>
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
      <Surface className="overlay scroll" id="ovFail" tag="div">
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
            <div className="ledger" id="failLedger"></div>
            <div className="insights" id="failInsights" hidden></div>
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
            <CashPill id="shopCoins" />
          </div>
          <div className="tabs" role="tablist">
            <button id="tabUp" className="on">
              <Icon name="upgrade" />
              <span className="buttonLabel">{"Upgrades"}</span>
            </button>
            <button id="tabBuka">
              <Icon name="shop" />
              <span className="buttonLabel">{"Buka"}</span>
            </button>
            <button id="tabStaff">
              <Icon name="staff" />
              <span className="buttonLabel">{"Staff"}</span>
            </button>
            <button id="tabBoost">
              <Icon name="boost" />
              <span className="buttonLabel">{"Boosters"}</span>
            </button>
            <button id="tabStyle">
              <Icon name="style" />
              <span className="buttonLabel">{"Style"}</span>
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
      <Surface className="overlay" id="ovMissions" tag="div">
        <div className="panel">
          <div className="shopHead">
            <div className="ribbon small" style={{ margin: "0" }}>
              {"Missions"}
            </div>
            <CashPill id="missionCoins" />
          </div>
          <div className="tabs two">
            <button id="tabDailyM" className="on">
              <Icon name="target" />
              <span className="buttonLabel">{"Today"}</span>
            </button>
            <button id="tabAch">
              <Icon name="check" />
              <span className="buttonLabel">{"Achievements"}</span>
            </button>
          </div>
          <div className="shopList scroll" id="missionList"></div>
          <div className="btnRow" style={{ marginTop: "12px" }}>
            <button className="btn coral" id="missionsClose">
              <Icon name="close" />
              <span className="buttonLabel">{"Close"}</span>
            </button>
          </div>
        </div>
      </Surface>
      <Surface className="overlay scroll" id="ovSettings" tag="div">
        <div className="panel">
          <div className="ribbon">{"Settings"}</div>
          <div className="pauseList">
            <Toggle id="sSound" label="Sound effects" />
            <Toggle id="sMusic" label="Music" />
            <Toggle id="sHaptics" label="Vibration" />
            <Toggle id="sQuality" label="High quality graphics" />
            <div className="toggle nameRow">
              <label htmlFor="playerName">{"Buka name"}</label>
              <input
                id="playerName"
                className="nameInput"
                maxLength={30}
                placeholder="Mama Put"
                autoComplete="off"
              />
              <button className="btn teal small" id="savePlayerName">
                {"Save"}
              </button>
            </div>
            <p className="sub small" id="onlineStatus">
              {"Offline mode"}
            </p>
            <button className="btn gold" id="sAccount">
              <Icon name="user" />
              <span className="buttonLabel">{"Account & coins"}</span>
            </button>
            <button className="btn teal" id="sBackup">
              <Icon name="cloud" />
              <span className="buttonLabel">{"Backup & cloud save"}</span>
            </button>
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
      <Surface className="overlay scroll" id="ovOpen" tag="div">
        <div className="panel openPanel">
          <div className="ribbon">{"New Restaurant!"}</div>
          <img className="openArt" id="openArt" alt="" hidden />
          <h3 className="openName" id="openName"></h3>
          <p className="sub small" id="openArea"></p>
          <p className="sub" id="openSub"></p>
          <div className="stats">
            <div className="stat">
              <span>{"Opening cost"}</span>
              <b>
                <i className="note"></i>
                <span id="openCost">{"₦0"}</span>
              </b>
            </div>
            <div className="stat">
              <span>{"You have"}</span>
              <b id="openHave">{"₦0"}</b>
            </div>
          </div>
          <div className="btnRow">
            <button className="btn plain" id="openLater">
              <Icon name="close" />
              <span className="buttonLabel">{"Later"}</span>
            </button>
            <button className="btn green grow pulse" id="openGo">
              <Icon name="shop" />
              <span className="buttonLabel">{"Open it"}</span>
            </button>
          </div>
        </div>
      </Surface>
      <Surface className="overlay" id="ovMarket" tag="div">
        <div className="panel">
          <div className="shopHead">
            <div className="ribbon small" style={{ margin: "0" }}>
              {"Market"}
            </div>
            <CashPill id="marketCoins" />
          </div>
          <div className="shopList scroll" id="marketList"></div>
          <div className="btnRow" style={{ marginTop: "12px" }}>
            <button className="btn coral" id="marketClose">
              <Icon name="close" />
              <span className="buttonLabel">{"Close"}</span>
            </button>
          </div>
        </div>
      </Surface>
      <Surface className="overlay" id="ovBoard" tag="div">
        <div className="panel">
          <div className="ribbon small">{"Leaderboard"}</div>
          <div className="tabs three" id="boardTabs">
            <button id="tabBoardSales" className="on">
              <Icon name="note" />
              <span className="buttonLabel">{"Top Bukas"}</span>
            </button>
            <button id="tabBoardStars">
              <Icon name="star" />
              <span className="buttonLabel">{"Stars"}</span>
            </button>
            <button id="tabBoardEndless">
              <Icon name="infinity" />
              <span className="buttonLabel">{"Endless"}</span>
            </button>
          </div>
          <label className="boardScope" id="boardScopeRow" hidden>
            <input type="checkbox" id="boardScope" />
            <span>{"Lagos Life players only"}</span>
          </label>
          <div className="shopList scroll" id="boardList"></div>
          <div className="btnRow" style={{ marginTop: "12px" }}>
            <button className="btn coral" id="boardClose">
              <Icon name="close" />
              <span className="buttonLabel">{"Close"}</span>
            </button>
          </div>
        </div>
      </Surface>
      <Surface className="overlay" id="ovGrow" tag="div">
        <div className="panel">
          <div className="shopHead">
            <div className="ribbon small" style={{ margin: "0" }}>
              {"Grow Your Business"}
            </div>
            <CashPill id="growCoins" />
          </div>
          <button className="btn teal booksBtn" id="growBooks" type="button">
            <Icon name="note" />
            <span className="buttonLabel">{"Business books"}</span>
          </button>
          <div className="shopList scroll" id="growList"></div>
          <div className="btnRow" style={{ marginTop: "12px" }}>
            <button className="btn coral" id="growClose">
              <Icon name="close" />
              <span className="buttonLabel">{"Close"}</span>
            </button>
          </div>
        </div>
      </Surface>
      <Surface className="overlay scroll" id="ovInspect" tag="div">
        <div className="panel inspectPanel">
          <div className="ribbon small">{"Health Inspector"}</div>
          <p className="inspSay" id="inspLine"></p>
          <p className="sub small" id="inspInfo"></p>
          <div className="inspBtns">
            <button className="btn coral" id="inspPay" type="button">
              <i className="note" />
              <span className="buttonLabel">{"Pay the fine"}</span>
            </button>
            <button className="btn gold" id="inspOffer0" type="button">
              <span className="buttonLabel"></span>
            </button>
            <button className="btn gold" id="inspOffer1" type="button">
              <span className="buttonLabel"></span>
            </button>
            <button className="btn gold" id="inspOffer2" type="button">
              <span className="buttonLabel"></span>
            </button>
            <button className="btn plain" id="inspBeg" type="button">
              <Icon name="heart" />
              <span className="buttonLabel">{"Beg for a warning"}</span>
            </button>
          </div>
        </div>
      </Surface>
      <Surface className="overlay scroll" id="ovAccount" tag="div">
        <div className="panel accountPanel">
          <div className="ribbon small">{"Account"}</div>
          <div id="accGuest">
            <p className="sub small" id="accIntro">
              {
                "Sign in to keep your buka on every phone, earn coins and play with the same account in Lagos Life and Lagos War."
              }
            </p>
            <button className="btn gold accLagos" id="accLagos" hidden>
              <Icon name="star" />
              <span className="buttonLabel">{"Continue with Lagos Life"}</span>
            </button>
            <div className="tabs two" id="accTabs">
              <button id="tabLogin" className="on" type="button">
                <span className="buttonLabel">{"Log in"}</span>
              </button>
              <button id="tabRegister" type="button">
                <span className="buttonLabel">{"Create account"}</span>
              </button>
            </div>
            <form className="accForm" id="accForm" noValidate>
              <input
                id="accName"
                className="nameInput"
                placeholder="Your name"
                autoComplete="nickname"
                maxLength={30}
                aria-label="Your name"
                hidden
              />
              <input
                id="accEmail"
                className="nameInput"
                type="email"
                placeholder="Email"
                autoComplete="email"
                aria-label="Email"
              />
              <input
                id="accPassword"
                className="nameInput"
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                aria-label="Password"
              />
              <p className="accError" id="accError" role="alert" hidden></p>
              <button className="btn green" id="accSubmit" type="submit">
                <Icon name="check" />
                <span className="buttonLabel">{"Log in"}</span>
              </button>
            </form>
            <p className="sub small accHint" id="accGuestHint">
              {
                "Your progress on this phone joins your account when you sign in."
              }
            </p>
          </div>
          <div id="accSigned" hidden>
            <p className="accWho" id="accWho"></p>
            <div className="walletBox">
              <div className="walletCoins">
                <Icon name="coin" />
                <span id="accCoins">{"0"}</span>
                <small>{" coins"}</small>
              </div>
              <p className="sub small" id="accWalletNote"></p>
              <div className="toggle nameRow">
                <input
                  id="accSwap"
                  className="nameInput"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  aria-label="Coins to swap"
                />
                <button
                  className="btn teal small"
                  id="accSwapBtn"
                  type="button"
                >
                  {"Swap for ₦"}
                </button>
              </div>
            </div>
            <div className="accPacks" id="accPacks" hidden></div>
            <button className="btn plain" id="accLogout" type="button">
              <Icon name="exit" />
              <span className="buttonLabel">{"Log out"}</span>
            </button>
          </div>
          <button
            className="btn coral"
            id="accClose"
            type="button"
            style={{ width: "100%", marginTop: "10px" }}
          >
            <Icon name="close" />
            <span className="buttonLabel">{"Close"}</span>
          </button>
        </div>
      </Surface>
      <Surface className="overlay scroll" id="ovBackup" tag="div">
        <div className="panel">
          <div className="ribbon small">{"Backup & Cloud Save"}</div>
          <p className="sub small" id="backupSub">
            {
              "Copy this code to move your progress to another phone. Paste a code to restore."
            }
          </p>
          <textarea
            id="backupCode"
            className="codeBox"
            rows="4"
            spellCheck="false"
            aria-label="Backup code"
          ></textarea>
          <div className="btnRow" style={{ margin: "10px 0" }}>
            <button className="btn teal" id="backupCopy">
              <Icon name="copy" />
              <span className="buttonLabel">{"Copy"}</span>
            </button>
            <button className="btn gold" id="backupRestore">
              <Icon name="restart" />
              <span className="buttonLabel">{"Restore"}</span>
            </button>
          </div>
          <button
            className="btn green"
            id="cloudSync"
            style={{ width: "100%", marginBottom: "10px" }}
          >
            <Icon name="cloud" />
            <span className="buttonLabel">{"Sync with cloud"}</span>
          </button>
          <button
            className="btn coral"
            id="backupClose"
            style={{ width: "100%" }}
          >
            <Icon name="close" />
            <span className="buttonLabel">{"Close"}</span>
          </button>
        </div>
      </Surface>
      <Surface className="overlay" id="ovBooks" tag="div">
        <div className="panel booksPanel">
          <div className="ribbon small">{"Business Books"}</div>
          <div className="shopList scroll" id="booksList"></div>
          <div className="btnRow" style={{ marginTop: "12px" }}>
            <button className="btn coral" id="booksClose">
              <Icon name="close" />
              <span className="buttonLabel">{"Close"}</span>
            </button>
          </div>
        </div>
      </Surface>
      <Surface className="overlay scroll" id="ovReward" tag="div">
        <div className="panel">
          <div className="ribbon">{"Daily Reward!"}</div>
          <p className="sub" id="rewardSub">
            {"Welcome back! Day 1 of your streak."}
          </p>
          <div className="rewardAmt">
            <i className="note big"></i>
            <span id="rewardAmt">{"₦1,500"}</span>
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
      <Surface className="overlay scroll" id="ovDaily" tag="div">
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
