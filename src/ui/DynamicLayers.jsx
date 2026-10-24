import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import { fmtNaira } from "../game/currency.js";

export function FoodButtons({ foods, data, tap }) {
  return foods.map((id) => {
    const food = data[id];
    return (
      <button
        key={id}
        className={"food" + (food.cook ? " cooks" : "")}
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
        <span className="pr">{fmtNaira(food.price)}</span>
        <img alt="" src={food.img || undefined} />
        <span className="nm">{food.short}</span>
        <span className="cd" />
        <span className="stage" aria-hidden="true">
          <span className="ring" />
          <span className="lbl" />
          <span className="stock" />
        </span>
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
      <i className="note" />
      {fmtNaira(cost)}
    </button>
  );
}

// Painted art from public/ui (see docs/ART_PROMPTS.md), else an icon.
function Portrait({ src, a, b, icon }) {
  return src ? (
    <img className="portrait" alt="" src={src} />
  ) : (
    <div className="swatch person" style={{ "--a": a, "--b": b }}>
      <Icon name={icon} />
    </div>
  );
}

function StaffCard({ s, save, art, hire, toggle, sack, unpaidLimit }) {
  const [arm, setArm] = useState(false);
  const hired = save.staff.includes(s.id),
    onDuty = hired && !save.staffOff.includes(s.id),
    owed = (save.unpaid || {})[s.id] || 0;
  return (
    <div className={"card staff" + (owed ? " owed" : "")}>
      <Portrait
        src={art["staff:" + s.id]}
        a={s.a}
        b={s.b}
        icon={s.role === "rider" ? "bike" : "staff"}
      />
      <div>
        <h4>
          {s.name} <small>· {s.title}</small>
        </h4>
        <p>{s.desc}</p>
        <p className="wage">Salary {fmtNaira(s.wage)} per shift</p>
        {owed ? (
          <p className="owedNote">
            Unpaid {owed} of {unpaidLimit} shifts. Keep enough cash for the next
            payday or {s.name} quits!
          </p>
        ) : null}
      </div>
      {hired ? (
        <div className="staffBtns">
          <button
            className={"btn " + (onDuty ? "teal" : "plain")}
            onClick={(e) => toggle(s, e.currentTarget.closest(".card"), e)}
            aria-pressed={onDuty}
          >
            <Icon name={onDuty ? "check" : "close"} />
            {onDuty ? "On duty" : "Off"}
          </button>
          <button
            className={"btn " + (arm ? "coral" : "plain")}
            onClick={() => {
              if (!arm) {
                setArm(true);
                setTimeout(() => setArm(false), 4000);
              } else sack(s);
            }}
          >
            <Icon name="sack" />
            {arm ? "Sure? Sack" : "Sack"}
          </button>
        </div>
      ) : (
        <BuyButton
          cost={s.cost}
          coins={save.coins}
          onClick={(e) => hire(s, e.currentTarget.closest(".card"), e)}
        />
      )}
    </div>
  );
}

export function Shop({
  tab,
  save,
  upgrades,
  outfits,
  decor,
  staff,
  boosters,
  buyUpgrade,
  buyOutfit,
  buyDecor,
  hireStaff,
  toggleStaff,
  sackStaff,
  unpaidLimit,
  art = {},
  buyBooster,
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
  if (tab === "staff")
    return (
      <>
        <div className="sectionLabel">Hire helping hands</div>
        <p className="hintText">
          Staff work every shift you play and are paid after it, from the
          shift&apos;s cash and then your savings. Unpaid {unpaidLimit} shifts
          in a row, they quit. Sack staff to save money.
        </p>
        {staff.map((s) => (
          <StaffCard
            key={s.id}
            s={s}
            save={save}
            art={art}
            hire={hireStaff}
            toggle={toggleStaff}
            sack={sackStaff}
            unpaidLimit={unpaidLimit}
          />
        ))}
      </>
    );
  if (tab === "boost")
    return (
      <>
        <div className="sectionLabel">Use these during a level</div>
        {boosters.map((b) => (
          <div className="card" key={b.id}>
            <div className="ic" style={{ "--bg": b.bg }}>
              {b.icon}
            </div>
            <div>
              <h4>
                {b.name} <small>· you have {save.boosters[b.id] || 0}</small>
              </h4>
              <p>{b.desc}</p>
            </div>
            <BuyButton
              cost={b.cost}
              coins={save.coins}
              onClick={buy(buyBooster, b)}
            />
          </div>
        ))}
      </>
    );
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

function MissionCard({
  title,
  sub,
  progress,
  goal,
  reward,
  done,
  claimed,
  onClaim,
}) {
  return (
    <div className={"card mission" + (claimed ? " claimed" : "")}>
      <div className="ic" style={{ "--bg": done ? "#C9F2EE" : "#FFE3B0" }}>
        {claimed ? "✅" : done ? "🎉" : "🎯"}
      </div>
      <div>
        <h4>{title}</h4>
        {sub ? <p>{sub}</p> : null}
        <div className="mbar" aria-label={`${progress} of ${goal}`}>
          <b
            style={{
              width: (Math.min(1, progress / goal) * 100).toFixed(0) + "%",
            }}
          />
          <span>
            {Math.min(progress, goal).toLocaleString()} /{" "}
            {goal.toLocaleString()}
          </span>
        </div>
      </div>
      {claimed ? (
        <button className="btn plain" disabled>
          <Icon name="check" />
          Done
        </button>
      ) : (
        <button
          className={"btn " + (done ? "gold pulse" : "plain")}
          disabled={!done}
          onClick={onClaim}
        >
          <i className="note" />
          {fmtNaira(reward)}
        </button>
      )}
    </div>
  );
}

export function Missions({
  tab,
  daily,
  achievements,
  save,
  progressOf,
  claim,
}) {
  if (tab === "daily")
    return (
      <>
        <div className="sectionLabel">New missions every day</div>
        {daily.map((m) => (
          <MissionCard
            key={m.id}
            title={m.text}
            progress={m.progress}
            goal={m.goal}
            reward={m.reward}
            done={m.progress >= m.goal}
            claimed={m.claimed}
            onClaim={(e) => claim(m.id, e)}
          />
        ))}
      </>
    );
  return achievements.map((a) => {
    const p = progressOf(a);
    return (
      <MissionCard
        key={a.id}
        title={a.name}
        progress={p}
        goal={a.goal}
        reward={a.reward}
        done={p >= a.goal}
        claimed={save.achievements.includes(a.id)}
        onClaim={(e) => claim(a.id, e)}
      />
    );
  });
}

export function Bubble({ customer, cols, foods, moods, select, rootRef }) {
  const mood = customer.mood && moods[customer.mood];
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
        {customer.name ? <span className="who">{customer.name}</span> : null}
        {mood ? (
          <span className="mood" title={mood.label} aria-label={mood.label}>
            {mood.e}
          </span>
        ) : null}
        <div className="say" />
        <div className="order" style={{ "--oc": cols }}>
          {customer.order.map((o, i) => (
            <div className={"it" + (o.layer === 1 ? " top" : "")} key={i}>
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

export function DirtyChip({ clear, rootRef }) {
  return (
    <button
      ref={rootRef}
      className="dirtyChip"
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        clear();
      }}
    >
      <Icon name="wash" />
      Clear
    </button>
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

// Online and catering orders waiting to be packed, shown above the food bar.
export function Orders({ orders, foods, events, art, selected, select, send }) {
  return orders.map((o) => {
    const done = o.items.every((it) => it.got >= it.need),
      ev = o.event && events[o.event];
    return (
      <div
        key={o.id}
        data-order={o.id}
        className={
          "ocard " +
          o.kind +
          (selected === o.id ? " sel" : "") +
          (done ? " done" : "") +
          (o.packing ? " packing" : "")
        }
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!done) select(o.id);
        }}
      >
        <div className="ohead">
          {art[o.kind === "event" ? "event:" + o.event : "online"] ? (
            <img
              className="oicon"
              alt=""
              src={art[o.kind === "event" ? "event:" + o.event : "online"]}
            />
          ) : (
            <span className="oicon">{ev ? ev.icon : "📱"}</span>
          )}
          <span className="otitle">
            {ev ? ev.name : o.who}
            <small>{o.where}</small>
          </span>
        </div>
        <div className="oitems">
          {o.items.map((it) => (
            <span
              key={it.f}
              className={"oit" + (it.got >= it.need ? " ok" : "")}
            >
              <img alt={foods[it.f].name} src={foods[it.f].img} />
              {it.need > 1 ? (
                <b>
                  {it.got}/{it.need}
                </b>
              ) : null}
            </span>
          ))}
        </div>
        {done ? (
          <button
            className="osend"
            onPointerDown={(e) => {
              e.stopPropagation();
              send(o.id);
            }}
          >
            <Icon name="pack" />
            {o.packing ? "Packing…" : "Pack & send"}
          </button>
        ) : null}
        <i className="otime">
          <b />
        </i>
      </div>
    );
  });
}

// Business size, reputation and branches in other places.
export function Grow({
  save,
  tier,
  tiers,
  next,
  places,
  art,
  check,
  open,
  visit,
  earned,
}) {
  return (
    <>
      <div className="growHead">
        <div>
          <small>Your business</small>
          <h4>{tiers[tier].name}</h4>
        </div>
        <div className="repBig" aria-label="Reputation">
          ★ {Math.round(save.reputation)}
        </div>
      </div>
      {next ? (
        <p className="hintText">
          Next: <b>{next.name}</b> at {fmtNaira(next.earn)} lifetime sales (now{" "}
          {fmtNaira(earned)}) and ★ {next.rep} reputation. Fast, correct service
          raises reputation and brings more customers.
        </p>
      ) : (
        <p className="hintText">
          You run a Food Empire. Every branch is open to you.
        </p>
      )}
      <div className="sectionLabel">Branches</div>
      {places.map((p) => {
        const owned = save.branches.includes(p.id),
          c = check(p),
          here = save.place === p.id;
        return (
          <div className={"card place" + (owned ? " owned" : "")} key={p.id}>
            {art["place:" + p.id] ? (
              <img className="portrait" alt="" src={art["place:" + p.id]} />
            ) : (
              <div
                className="ic"
                style={{ "--bg": owned ? "#C9F2EE" : "#EADBC4" }}
              >
                {owned ? "🏪" : "🔒"}
              </div>
            )}
            <div>
              <h4>
                {p.name} <small>· {p.area}</small>
              </h4>
              <p>
                {p.income
                  ? `Earns ${fmtNaira(p.income)} after every shift`
                  : "Where it all started"}
                {!owned && p.tier > tier
                  ? ` · Needs ${tiers[p.tier].name}`
                  : ""}
              </p>
            </div>
            {owned ? (
              <button
                className={"btn " + (here ? "plain" : "teal")}
                disabled={here}
                onClick={() => visit(p)}
              >
                <Icon name="map" />
                {here ? "Here" : "Visit"}
              </button>
            ) : (
              <button
                className={"btn " + (c.ok ? "green" : "plain")}
                onClick={(e) => open(p, e.currentTarget.closest(".card"), e)}
              >
                <i className="note" />
                {fmtNaira(p.cost)}
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

// End-of-shift money and reputation lines.
export function Ledger({ rows }) {
  return rows.map((r) => (
    <div className={"stat " + (r.cls || "")} key={r.label}>
      <span>{r.label}</span>
      <b>{r.value}</b>
    </div>
  ));
}
