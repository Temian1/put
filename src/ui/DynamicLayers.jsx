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

const STAR_PATH =
  "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z";
// Outlined star that reads on any background; `on` fills it gold.
export function Star({ on, className = "" }) {
  return (
    <svg
      className={"star " + (on ? "on " : "") + className}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d={STAR_PATH} />
    </svg>
  );
}

export function LevelMap({
  chapters,
  foods,
  save,
  start,
  locked,
  endless,
  places,
  openPlace,
}) {
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
        const got = Array.from(
          { length: 10 },
          (_, i) => save.stars[first + i] || 0,
        ).reduce((a, b) => a + b, 0);
        const place = places[ci],
          closed = !save.branches.includes(place.id),
          reached = save.unlocked >= first;
        return (
          <React.Fragment key={ch.name}>
            <div
              className={
                "chap" +
                (!reached || closed ? " locked" : "") +
                (closed && reached ? " toOpen" : "")
              }
              style={{
                background: `linear-gradient(135deg,${ch.color},color-mix(in srgb,${ch.color} 70%,#000))`,
              }}
            >
              <small>
                Chapter {ci + 1} · Levels {first}–{first + 9}
              </small>
              <h3>{ch.name}</h3>
              <div className="chapStars">
                <Star on />
                <b>{got}</b>/30
                <span className="chapBar">
                  <i style={{ width: (got / 30) * 100 + "%" }} />
                </span>
              </div>
              {closed && ci > 0 ? (
                <div className="chapOpen">
                  {reached ? (
                    <button className="btn gold" onClick={() => openPlace(ci)}>
                      <i className="note" />
                      Open for {fmtNaira(place.cost)}
                    </button>
                  ) : (
                    <span>
                      Beat level {first - 1}, then open for{" "}
                      {fmtNaira(place.cost)}
                    </span>
                  )}
                </div>
              ) : null}
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
                  isLocked = n > save.unlocked || closed;
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
                    onClick={() =>
                      isLocked
                        ? closed && reached
                          ? openPlace(ci)
                          : locked()
                        : start(n)
                    }
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
                      <span className="st" aria-label={`${stars} of 3 stars`}>
                        {[0, 1, 2].map((k) => (
                          <Star key={k} on={k < stars} className="mini" />
                        ))}
                      </span>
                    ) : null}
                    {i === 9 ? (
                      <span className="crown" aria-hidden="true">
                        👑
                      </span>
                    ) : null}
                    {n === save.unlocked ? (
                      <span className="here" aria-hidden="true">
                        PLAY
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

// Pay with Lagos Life money instead of naira (only inside Lagos Life).
function LagosButton({ offer }) {
  if (!offer) return null;
  return (
    <button
      className="btn lagosBuy"
      onClick={(e) => {
        e.stopPropagation();
        offer.buy(e.currentTarget);
      }}
      title={offer.name}
    >
      <Icon name="star" />
      Lagos Life
    </button>
  );
}

function BuyButton({ cost, owned, label = "Owned", coins, onClick, lagos }) {
  if (lagos && !owned)
    return (
      <div className="buyCol">
        <BuyButton cost={cost} coins={coins} onClick={onClick} />
        <LagosButton offer={lagos} />
      </div>
    );
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

const ROLE_ICON = { rider: "bike", manager: "chef" };

// A job you can hire for the chosen restaurant (several people per job).
function JobCard({ job, have, max, check, coins, art, hire }) {
  const c = check(job);
  return (
    <div className="card staff">
      <Portrait
        src={art["staff:" + job.id]}
        a={job.a}
        b={job.b}
        icon={ROLE_ICON[job.role] || "staff"}
      />
      <div>
        <h4>
          {job.title}
          {job.stars ? <small> · {"★".repeat(job.stars)}</small> : null}
        </h4>
        <p>{job.desc}</p>
        <p className="wage">
          {job.role === "manager"
            ? `Takes ${Math.round(job.pay * 100)}% of the takings`
            : `Salary ${fmtNaira(job.wage)} per shift`}{" "}
          · {have}/{max} here
        </p>
      </div>
      {c.ok ? (
        <BuyButton
          cost={job.cost}
          coins={coins}
          onClick={(e) => hire(job, e.currentTarget.closest(".card"), e)}
        />
      ) : (
        <button className="btn plain" disabled title={c.why}>
          <Icon name="check" />
          Full
        </button>
      )}
    </div>
  );
}

// Someone working at the chosen restaurant.
function CrewRow({ m, job, toggle, sack, pay, strikesMax }) {
  const [arm, setArm] = useState(false);
  const strikes = m.strikes || 0,
    manager = job.role === "manager";
  return (
    <div className={"card crew" + (strikes ? " owed" : "")}>
      <Portrait a={job.a} b={job.b} icon={ROLE_ICON[job.role] || "staff"} />
      <div>
        <h4>
          {m.name} <small>· {job.title}</small>
        </h4>
        <p className="wage">
          {manager
            ? "Runs this restaurant while you are away and pays its staff from the safe"
            : m.off
              ? "Off duty: no salary"
              : `On duty · ${fmtNaira(job.wage)} a day`}
        </p>
        {m.owed > 0 ? (
          <p className={strikes ? "owedNote" : "wage owedLine"}>
            Owed {fmtNaira(m.owed)}
            {strikes
              ? ` · not paid last month (strike ${strikes}/${strikesMax}). Working slowly until paid!`
              : ""}
          </p>
        ) : null}
      </div>
      <div className="staffBtns">
        {m.owed > 0 ? (
          <button className="btn green" onClick={() => pay(m)}>
            <i className="note" />
            Pay {fmtNaira(m.owed)}
          </button>
        ) : null}
        {manager ? null : (
          <button
            className={"btn " + (m.off ? "plain" : "teal")}
            onClick={() => toggle(m)}
            aria-pressed={!m.off}
          >
            <Icon name={m.off ? "close" : "check"} />
            {m.off ? "Off" : "On duty"}
          </button>
        )}
        <button
          className={"btn " + (arm ? "coral" : "plain")}
          onClick={() => {
            if (!arm) {
              setArm(true);
              setTimeout(() => setArm(false), 4000);
            } else sack(m);
          }}
        >
          <Icon name="sack" />
          {arm ? "Sure? Sack" : "Sack"}
        </button>
      </div>
    </div>
  );
}

// Which restaurant the Staff and Buka tabs are buying for.
function PlacePicker({ crew }) {
  return (
    <div className="placeChips" role="tablist">
      {crew.places.map((p) => (
        <button
          key={p.id}
          role="tab"
          aria-selected={p.id === crew.place}
          className={"placeChip" + (p.id === crew.place ? " on" : "")}
          onClick={() => crew.setPlace(p.id)}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

export function Shop({
  tab,
  save,
  upgrades,
  outfits,
  decor,
  crew,
  boosters,
  buyUpgrade,
  buyOutfit,
  buyDecor,
  hireStaff,
  toggleStaff,
  sackStaff,
  art = {},
  buyBooster,
  equipment = [],
  equipLevel,
  buyEquip,
  lagos = () => null,
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
            lagos={max ? null : lagos("upgrade", u.id)}
            owned={max}
            label="Max"
            coins={save.coins}
            onClick={buy(buyUpgrade, u)}
          />
        </div>
      );
    });
  if (tab === "staff") {
    const jobOf = (id) => crew.jobs.find((j) => j.id === id);
    const here = crew.places.find((p) => p.id === crew.place);
    return (
      <>
        <div className="sectionLabel">Staff for each restaurant</div>
        <PlacePicker crew={crew} />
        <div className={"payday" + (crew.payday.left <= 2 ? " soon" : "")}>
          <div>
            <small>
              Month {crew.payday.month} · day {crew.payday.day} of{" "}
              {crew.payday.days}
            </small>
            <b>
              Payday in {crew.payday.left} day
              {crew.payday.left === 1 ? "" : "s"}
            </b>
            <span>Owed here: {fmtNaira(crew.payday.owed)}</span>
          </div>
          <button
            className={"btn " + (crew.payday.owed ? "green" : "plain")}
            disabled={!crew.payday.owed}
            onClick={() => crew.payAll()}
          >
            <i className="note" />
            Pay all
          </button>
        </div>
        <p className="hintText">
          {here ? here.name : "This restaurant"} has its own crew. Each shift
          you play is one working day and every worker on duty earns a
          day&apos;s wage. You pay them yourself; a month is {crew.payday.days}{" "}
          days. Anyone still owed at month end works slowly, and after{" "}
          {crew.payday.strikes} unpaid months they quit. A manager keeps the
          restaurant open while you play elsewhere.
        </p>
        {crew.members.length ? (
          <>
            <div className="sectionLabel">
              Working here ({crew.members.length})
            </div>
            {crew.members.map((m) =>
              jobOf(m.job) ? (
                <CrewRow
                  key={m.uid}
                  m={m}
                  job={jobOf(m.job)}
                  toggle={toggleStaff}
                  sack={sackStaff}
                  pay={crew.pay}
                  strikesMax={crew.payday.strikes}
                />
              ) : null,
            )}
          </>
        ) : null}
        <div className="sectionLabel">Hire</div>
        {crew.jobs.map((j) => (
          <JobCard
            key={j.id}
            job={j}
            have={crew.count(j.role)}
            max={crew.limit[j.role] || 1}
            check={crew.check}
            coins={save.coins}
            art={art}
            hire={hireStaff}
          />
        ))}
      </>
    );
  }
  if (tab === "buka")
    return (
      <>
        <div className="sectionLabel">Equipment for each restaurant</div>
        <PlacePicker crew={crew} />
        <p className="hintText">
          Everything you buy appears in that restaurant only. Most items cost
          upkeep (gas, light, repairs) after every shift. At a restaurant a
          manager runs, equipment raises its takings.
        </p>
        {equipment.map((it) => {
          const lv = equipLevel(it.id),
            max = lv >= it.costs.length;
          return (
            <div className="card" key={it.id}>
              <div className="ic" style={{ "--bg": "#FFE3B0" }}>
                {it.icon}
              </div>
              <div>
                <h4>
                  {it.name}
                  {it.costs.length > 1 ? (
                    <small>
                      {" "}
                      · {lv}/{it.costs.length}
                    </small>
                  ) : null}
                </h4>
                <p>{it.desc}</p>
                {it.upkeep ? (
                  <p className="wage">Upkeep {fmtNaira(it.upkeep)} per shift</p>
                ) : null}
              </div>
              <BuyButton
                cost={it.costs[lv]}
                lagos={max ? null : lagos("equipment", it.id)}
                owned={max}
                label={it.costs.length > 1 ? "Max" : "Owned"}
                coins={save.coins}
                onClick={buy(buyEquip, it)}
              />
            </div>
          );
        })}
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
              lagos={lagos("booster", b.id)}
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
                lagos={lagos("outfit", o.id)}
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
            lagos={lagos("decor", d.id)}
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

export function Bubble({
  customer,
  cols,
  foods,
  moods,
  select,
  rootRef,
  onHaggle,
}) {
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
        {customer.haggle ? (
          <div className="haggle">
            <span className="hq">
              {fmtNaira(customer.haggle.full)} too much!{" "}
              {fmtNaira(customer.haggle.offer)}?
            </span>
            <span className="hbtns">
              <button
                className="hb ok"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onHaggle("accept");
                }}
              >
                {fmtNaira(customer.haggle.offer)}
              </button>
              <button
                className="hb mid"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onHaggle("meet");
                }}
              >
                Meet halfway
              </button>
              <button
                className="hb no"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onHaggle("refuse");
                }}
              >
                No
              </button>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DirtyChip({ clear, rootRef, small, litter }) {
  return (
    <button
      ref={rootRef}
      className={
        "dirtyChip" + (small ? " small" : "") + (litter ? " litter" : "")
      }
      aria-label={litter ? "Sweep litter" : "Clear table"}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        clear();
      }}
    >
      <Icon name={litter ? "broom" : "wash"} />
      {small ? null : "Clear"}
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
  playAt,
  earned,
  manager,
  till,
  tillTotal,
  collect,
  staffAt,
  openNow,
  hours,
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
          You run a Food Empire. Keep the bills paid and reputation high.
        </p>
      )}
      <p className={"openHours" + (openNow ? " open" : "")}>
        {openNow ? "Open now" : "Closed now"} · restaurants open {hours} Lagos
        time. Those with a manager earn during opening hours, even while you are
        offline.
      </p>
      {tillTotal ? (
        <button className="btn gold collectAll" onClick={() => collect()}>
          <i className="note" />
          Collect {fmtNaira(tillTotal)} from your managers
        </button>
      ) : null}
      <div className="sectionLabel">Your restaurants</div>
      <p className="hintText">
        Each chapter is a new restaurant with its own staff. Beat the chapter
        before it, then pay to open it. Put a manager in charge and it keeps
        earning while you play elsewhere; collect the money here.
      </p>
      {places.map((p) => {
        const owned = save.branches.includes(p.id),
          c = check(p),
          here = save.place === p.id,
          reached = save.unlocked >= p.firstLevel;
        return (
          <div className={"card place" + (owned ? " owned" : "")} key={p.id}>
            {art["place:" + p.id] ? (
              <img className="portrait" alt="" src={art["place:" + p.id]} />
            ) : (
              <div
                className="ic"
                style={{ "--bg": owned ? "#C9F2EE" : "#EADBC4" }}
              >
                {owned ? "🏪" : reached ? "🔑" : "🔒"}
              </div>
            )}
            <div>
              <h4>
                {p.name} <small>· {p.area}</small>
              </h4>
              <p>
                Levels {p.firstLevel}–{p.firstLevel + 9}
                {p.income
                  ? ` · up to ${fmtNaira(p.income)} per shift with a manager`
                  : " · where it all started"}
              </p>
              {owned && p.income ? (
                <p className={"mgrLine" + (manager(p) ? "" : " none")}>
                  {manager(p)
                    ? `${manager(p).name} ${"★".repeat(manager(p).stars)} · safe ${fmtNaira(till(p))}`
                    : "No manager: shut while you play elsewhere"}
                </p>
              ) : null}
            </div>
            {owned ? (
              <div className="staffBtns">
                {till(p) ? (
                  <button className="btn gold" onClick={() => collect(p)}>
                    <i className="note" />
                    Collect
                  </button>
                ) : null}
                <button className="btn plain" onClick={() => staffAt(p)}>
                  <Icon name="staff" />
                  Staff
                </button>
                <button className="btn green" onClick={() => playAt(p)}>
                  <Icon name="play" />
                  Play
                </button>
                <button
                  className={"btn " + (here ? "plain" : "teal")}
                  disabled={here}
                  onClick={() => visit(p)}
                >
                  <Icon name="map" />
                  {here ? "Here" : "Visit"}
                </button>
              </div>
            ) : reached ? (
              <button
                className={"btn " + (c.ok ? "green" : "plain")}
                onClick={(e) => open(p, e.currentTarget.closest(".card"), e)}
              >
                <i className="note" />
                {fmtNaira(p.cost)}
              </button>
            ) : (
              <button className="btn plain" disabled>
                <Icon name="lock" />
                Level {p.firstLevel - 1}
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

// Ranked list for the leaderboard. The player's row is highlighted.
export function Board({ rows, unit, fmt, note }) {
  return (
    <>
      <p className="hintText">{note || "Real Mama Put Rush players."}</p>
      {rows.map((r) => (
        <div
          key={r.rank + r.name}
          className={
            "boardRow" + (r.you ? " you" : "") + (r.rank <= 3 ? " top" : "")
          }
        >
          <span className="rank">
            {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}
          </span>
          <span className="who">
            <b>{r.name}</b>
            <small>{r.where}</small>
          </span>
          <span className="val">
            {unit === "stars" ? (
              <>
                <Star on className="mini" /> {r.value}
              </>
            ) : (
              fmt(r.value)
            )}
          </span>
        </div>
      ))}
    </>
  );
}

// Market stalls: stock up before prices rise. Perishables spoil without a freezer.
export function Market({ items, news, index, cap, fridge, buy, place }) {
  return (
    <>
      <div className="marketNews">
        <b>
          Prices today: {Math.round((index - 1) * 1000) / 10 >= 0 ? "+" : ""}
          {Math.round((index - 1) * 1000) / 10}%
        </b>
        <span>{news || "Normal market day."}</span>
      </div>
      <p className="hintText">
        Only what {place || "your restaurant"}&apos;s menu needs is on sale.
        Every pot or pan you cook uses one unit from your store. With none in
        store you buy on the spot for 40% more. Store holds {cap} of each.
        {fridge
          ? ""
          : " Without a deep freezer, perishables lose a quarter after every shift."}
      </p>
      {items.map((it) => (
        <div className={"card market" + (it.out ? " out" : "")} key={it.id}>
          <div
            className="ic"
            style={{ "--bg": it.out ? "#EADBC4" : "#D3F5DA" }}
          >
            {it.icon}
          </div>
          <div>
            <h4>
              {it.name}{" "}
              <small>
                · in store {it.have}/{cap}
              </small>
            </h4>
            <p>
              {it.out
                ? "Sold out at the market today"
                : `${fmtNaira(it.price)} per ${it.unit}${it.perish ? " · spoils" : ""}`}
            </p>
            <p className="uses">For: {it.uses}</p>
          </div>
          <div className="staffBtns">
            <button
              className={"btn " + (it.out ? "plain" : "green")}
              disabled={it.out || it.have >= cap}
              onClick={(e) => buy(it.id, 1, e)}
            >
              +1
            </button>
            <button
              className={"btn " + (it.out ? "plain" : "teal")}
              disabled={it.out || it.have >= cap}
              onClick={(e) => buy(it.id, 5, e)}
            >
              +5
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
