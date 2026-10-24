import React from "react";
import { Icon } from "./Icon.jsx";

export function FoodButtons({ foods, data, tap }) {
  return foods.map((id) => {
    const food = data[id];
    return (
      <button
        key={id}
        className="food"
        data-id={id}
        style={{ "--c": food.color }}
        aria-label={food.name}
        onPointerDown={(e) => {
          e.preventDefault();
          tap(id, e.currentTarget);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            tap(id, e.currentTarget);
          }
        }}
      >
        <Icon name="serve" className="serveIcon" />
        <span className="pr">{food.price}</span>
        <img alt="" src={food.img || undefined} />
        <span className="nm">{food.name}</span>
        <span className="cd" />
      </button>
    );
  });
}

export function LevelMap({ chapters, foods, save, start, locked, endless }) {
  const STEP = 96;
  return (
    <>
      {chapters.map((ch, ci) => {
        const first = ci * 10 + 1;
        const xs = Array.from(
          { length: 10 },
          (_, i) => 50 + Math.sin(i * 1.05 + ci) * 30,
        );
        const d = xs
          .map((x, i) => `${i ? " L " : "M "}${x} ${i * STEP + 50}`)
          .join("");
        return (
          <React.Fragment key={ch.name}>
            <div
              className={"chap" + (save.unlocked < first ? " locked" : "")}
              style={{
                background: `linear-gradient(135deg,${ch.color},color-mix(in srgb,${ch.color} 70%,#000))`,
              }}
            >
              <small>
                Chapter {ci + 1} · Levels {first}–{first + 9}
              </small>
              <h3>{ch.name}</h3>
              <div className="foods">
                {ch.foods.map((f) => (
                  <img key={f} alt={foods[f].name} src={foods[f].img} />
                ))}
              </div>
            </div>
            <div className="path" style={{ height: 10 * STEP + 30 }}>
              <svg
                viewBox={`0 0 100 ${10 * STEP + 30}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d={d}
                  fill="none"
                  stroke="rgba(74,31,12,.18)"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={d}
                  fill="none"
                  stroke="#FFF4DE"
                  strokeWidth="5"
                  strokeDasharray="2 12"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {xs.map((x, i) => {
                const n = first + i,
                  stars = save.stars[n] || 0,
                  isLocked = n > save.unlocked;
                return (
                  <button
                    key={n}
                    aria-label={`Level ${n}${isLocked ? " locked" : ""}`}
                    className={
                      "node" +
                      (i === 9 ? " boss" : "") +
                      (isLocked ? " locked" : stars ? " done" : "") +
                      (n === save.unlocked ? " current" : "")
                    }
                    style={{ left: x + "%", top: i * STEP + 50 }}
                    onClick={() => (isLocked ? locked() : start(n))}
                  >
                    {isLocked ? (
                      <Icon name="lock" />
                    ) : (
                      <span className="levelNumber">
                        <Icon name="play" />
                        {n}
                      </span>
                    )}
                    {!isLocked ? (
                      <span className="st">
                        {[0, 1, 2].map((k) => (
                          <i
                            key={k}
                            className={"mini-star" + (k < stars ? " on" : "")}
                          />
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </React.Fragment>
        );
      })}
      <div className="endlessCard">
        <button
          className="btn gold big"
          disabled={save.unlocked <= 50}
          onClick={endless}
        >
          <Icon name="infinity" />
          Endless Rush
        </button>
        <p className="sub" style={{ marginTop: 12 }}>
          {save.unlocked > 50
            ? "Personal best: " + save.endlessBest
            : "Complete Level 50 to open the Endless Rush"}
        </p>
      </div>
    </>
  );
}

function BuyButton({ cost, owned, label = "Owned", coins, onClick }) {
  return owned ? (
    <button className="btn plain" disabled>
      <Icon name="check" />
      {label}
    </button>
  ) : (
    <button
      className={"btn " + (coins >= cost ? "green" : "plain")}
      onClick={onClick}
    >
      <Icon name="coin" />
      <i className="coin" />
      {cost}
    </button>
  );
}

export function Shop({
  tab,
  save,
  upgrades,
  outfits,
  decor,
  buyUpgrade,
  buyOutfit,
  buyDecor,
}) {
  const buy = (fn, item) => (e) =>
    fn(item, e.currentTarget.closest(".card"), e);
  if (tab === "up")
    return upgrades.map((u) => {
      const level = save.up[u.id],
        max = level >= u.costs.length;
      return (
        <div className="card" key={u.id}>
          <div className="ic" style={{ "--bg": u.bg }}>
            {u.icon}
          </div>
          <div>
            <h4>{u.name}</h4>
            <p>{u.desc}</p>
            <div className="lv">
              {u.costs.map((_, i) => (
                <i key={i} className={i < level ? "on" : ""} />
              ))}
            </div>
          </div>
          <BuyButton
            cost={u.costs[level]}
            owned={max}
            label="Max"
            coins={save.coins}
            onClick={buy(buyUpgrade, u)}
          />
        </div>
      );
    });
  return (
    <>
      <div className="sectionLabel">Chef outfits</div>
      {outfits.map((o) => {
        const owned = save.outfits.includes(o.id),
          equipped = save.outfit === o.id;
        return (
          <div className="card" key={o.id}>
            <div className="swatch" style={{ "--a": o.a, "--b": o.b }} />
            <div>
              <h4>{o.name}</h4>
              <p>
                {equipped
                  ? "Wearing now"
                  : owned
                    ? "Tap to wear"
                    : "Fresh ankara for Mama"}
              </p>
            </div>
            {owned ? (
              <button
                className={"btn " + (equipped ? "plain" : "teal")}
                disabled={equipped}
                onClick={buy(buyOutfit, o)}
              >
                <Icon name="chef" />
                {equipped ? "Worn" : "Wear"}
              </button>
            ) : (
              <BuyButton
                cost={o.cost}
                coins={save.coins}
                onClick={buy(buyOutfit, o)}
              />
            )}
          </div>
        );
      })}
      <div className="sectionLabel">Kitchen decorations</div>
      {decor.map((d) => (
        <div className="card" key={d.id}>
          <div className="ic" style={{ "--bg": d.bg }}>
            {d.icon}
          </div>
          <div>
            <h4>{d.name}</h4>
            <p>{d.desc}</p>
          </div>
          <BuyButton
            cost={d.cost}
            owned={save.decor.includes(d.id)}
            coins={save.coins}
            onClick={buy(buyDecor, d)}
          />
        </div>
      ))}
    </>
  );
}

export function Bubble({ customer, cols, foods, select, rootRef }) {
  return (
    <div
      ref={rootRef}
      className={"bubble" + (customer.vip ? " vip" : "")}
      style={{ opacity: 0 }}
      onPointerDown={(e) => {
        e.stopPropagation();
        select();
      }}
    >
      <div className="in">
        {customer.vip ? <span className="tag">VIP x2</span> : null}
        <div className="say" />
        <div className="order" style={{ "--oc": cols }}>
          {customer.order.map((o, i) => (
            <div className="it" key={i}>
              <img alt={foods[o.f].name} src={foods[o.f].img} />
            </div>
          ))}
        </div>
        <div className="pat">
          <b />
        </div>
      </div>
    </div>
  );
}

export function DailyMods({ mods }) {
  return mods.map((m) => (
    <div className="mod" key={m.id}>
      <span className="e">{m.e}</span>
      <div>
        <b>{m.name}</b>
        <span>{m.desc}</span>
      </div>
    </div>
  ));
}
