import { useEffect, useMemo, useState } from "react";
import { HEADLINES, hourSlot, supabase } from "./supabase";

function prettyTime(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return ""; }
}

function remaining() {
  const n = new Date();
  const end = new Date(n);
  end.setMinutes(60, 0, 0);
  const ms = end - n;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function handleFrom(email, profile) {
  if (profile?.handle) return profile.handle;
  if (profile?.display_name) return profile.display_name;
  if (!email) return "someone";
  return email.split("@")[0];
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [notes, setNotes] = useState([]);
  const [mine, setMine] = useState([]);
  const [hour, setHour] = useState(null);
  const [log, setLog] = useState([]);
  const [tab, setTab] = useState("wall");
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(remaining());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick(remaining()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { loadPublic(); ensureHour(); loadLog(); }, []);

  useEffect(() => {
    if (!session?.user) { setProfile(null); setMine([]); return; }
    loadProfile(session.user);
    loadMine(session.user.id);
  }, [session]);

  async function loadPublic() {
    const q = await supabase.from("notes").select("id,title,body,created_at,user_id,is_public,profiles(handle,display_name)").eq("is_public", true).order("created_at", { ascending: false }).limit(40);
    if (q.error) {
      const { data } = await supabase.from("notes").select("id,title,body,created_at,user_id,is_public").eq("is_public", true).order("created_at", { ascending: false }).limit(40);
      setNotes(data || []);
      return;
    }
    setNotes(q.data || []);
  }

  async function loadMine(uid) {
    const { data } = await supabase.from("notes").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    setMine(data || []);
  }

  async function loadProfile(user) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) { setProfile(data); setHandle(data.handle || ""); return; }
    const seed = (user.email || "guest").split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 16) || "guest";
    const { data: created } = await supabase.from("profiles").insert({ id: user.id, handle: seed, display_name: seed }).select().maybeSingle();
    setProfile(created);
    setHandle(seed);
  }

  async function loadLog() {
    const { data } = await supabase.from("hourly_log").select("*").order("created_at", { ascending: false }).limit(8);
    setLog(data || []);
  }

  async function ensureHour() {
    const slot = hourSlot();
    const { data } = await supabase.from("hours").select("*").eq("slot", slot).maybeSingle();
    if (data) { setHour(data); return; }
    const pair = HEADLINES[new Date().getHours() % HEADLINES.length];
    const row = { slot, headline: pair[0], editorial: pair[1] };
    const { data: inserted } = await supabase.from("hours").insert(row).select().maybeSingle();
    setHour(inserted || row);
    await supabase.from("hourly_log").insert({ title: pair[0], body: pair[1] });
    loadLog();
  }

  async function auth(e) {
    e.preventDefault(); setErr(""); setMsg(""); setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Check your inbox if confirmation is on. Otherwise you can sign in now.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthOpen(false);
      }
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  }

  async function saveNote(e) {
    e.preventDefault();
    if (!session?.user) { setAuthOpen(true); return; }
    if (!title.trim() || !body.trim()) return;
    setBusy(true); setErr("");
    const { error } = await supabase.from("notes").insert({
      user_id: session.user.id, title: title.trim().slice(0, 120), body: body.trim(), is_public: isPublic,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setTitle(""); setBody("");
    loadPublic(); loadMine(session.user.id);
    setTab(isPublic ? "wall" : "desk");
  }

  async function togglePublic(note) {
    await supabase.from("notes").update({ is_public: !note.is_public }).eq("id", note.id);
    loadPublic(); if (session?.user) loadMine(session.user.id);
  }

  async function removeNote(id) {
    await supabase.from("notes").delete().eq("id", id);
    loadPublic(); if (session?.user) loadMine(session.user.id);
  }

  async function saveHandle(e) {
    e.preventDefault();
    if (!session?.user || !handle.trim()) return;
    const h = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    const { error } = await supabase.from("profiles").update({ handle: h, display_name: h }).eq("id", session.user.id);
    if (error) setErr(error.message);
    else { setProfile((p) => ({ ...p, handle: h, display_name: h })); setMsg("Handle saved."); }
  }

  const wall = useMemo(() => notes.filter((n) => n.is_public), [notes]);

  return (
    <div className="page">
      <div className="grain" aria-hidden="true" />
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <div>
            <p className="word">Oak Hour</p>
            <p className="tag">a public desk · turns every hour</p>
          </div>
        </div>
        <div className="clock">
          <div className="ring"><i style={{ transform: `rotate(${(60 - parseInt(tick, 10)) * 6}deg)` }} /></div>
          <div>
            <p className="left">{tick}</p>
            <p className="until">until the board turns</p>
          </div>
        </div>
        <div className="who">
          {session?.user ? (
            <>
              <button className="ghost" onClick={() => setTab("desk")}>@{handleFrom(session.user.email, profile)}</button>
              <button className="ghost" onClick={() => supabase.auth.signOut()}>leave</button>
            </>
          ) : (
            <button className="solid" onClick={() => setAuthOpen(true)}>sit down</button>
          )}
        </div>
      </header>

      <section className="hourboard">
        <p className="kicker">this hour</p>
        <h1 className="headline">{hour?.headline || "The desk is open"}</h1>
        <p className="editorial">{hour?.editorial || "Write something. Mark it public and it hangs on the wall."}</p>
      </section>

      <nav className="tabs">
        <button className={tab === "wall" ? "on" : ""} onClick={() => setTab("wall")}>the wall</button>
        <button className={tab === "desk" ? "on" : ""} onClick={() => setTab("desk")}>the desk</button>
        <button className={tab === "ledger" ? "on" : ""} onClick={() => setTab("ledger")}>the ledger</button>
      </nav>

      {tab === "wall" && (
        <main className="grid">
          {wall.length === 0 && <p className="empty">Nothing public yet. Be the first to pin a note.</p>}
          {wall.map((n, i) => (
            <article className="card" key={n.id} style={{ animationDelay: `${i * 40}ms` }}>
              <h2>{n.title}</h2>
              <p>{n.body}</p>
              <footer>
                <span>@{n.profiles?.handle || handleFrom("", n.profiles)}</span>
                <time>{prettyTime(n.created_at)}</time>
              </footer>
            </article>
          ))}
        </main>
      )}

      {tab === "desk" && (
        <main className="desk">
          <form className="compose" onSubmit={saveNote}>
            <label>title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="a line that holds" /></label>
            <label>note<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder="what you almost kept to yourself" /></label>
            <label className="check"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />hang this on the wall</label>
            <button className="solid" disabled={busy} type="submit">{session ? "save" : "sit down to save"}</button>
            {err && <p className="err">{err}</p>}
            {msg && <p className="ok">{msg}</p>}
          </form>
          <aside className="drawer">
            <h3>your drawer</h3>
            {!session && <p className="muted">Sign in to keep private notes and publish when you want.</p>}
            {session && (
              <form className="handleform" onSubmit={saveHandle}>
                <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="handle" />
                <button type="submit" className="ghost">set</button>
              </form>
            )}
            <ul>
              {mine.map((n) => (
                <li key={n.id}>
                  <div><strong>{n.title}</strong><em>{n.is_public ? "on the wall" : "private"}</em></div>
                  <div className="row">
                    <button className="ghost" onClick={() => togglePublic(n)}>{n.is_public ? "make private" : "publish"}</button>
                    <button className="ghost danger" onClick={() => removeNote(n.id)}>burn</button>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </main>
      )}

      {tab === "ledger" && (
        <main className="ledger">
          {log.map((row) => (
            <article key={row.id}>
              <time>{prettyTime(row.created_at)}</time>
              <h2>{row.title}</h2>
              <p>{row.body}</p>
            </article>
          ))}
        </main>
      )}

      {authOpen && (
        <div className="veil" onClick={() => setAuthOpen(false)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={auth}>
            <p className="kicker">{mode === "signup" ? "take a seat" : "welcome back"}</p>
            <h2>{mode === "signup" ? "Make a desk" : "Sit down"}</h2>
            <label>email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>password<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            {err && <p className="err">{err}</p>}
            {msg && <p className="ok">{msg}</p>}
            <button className="solid" disabled={busy} type="submit">{mode === "signup" ? "create" : "enter"}</button>
            <button type="button" className="ghost" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
              {mode === "signup" ? "already have a desk" : "need a desk"}
            </button>
          </form>
        </div>
      )}

      <footer className="floor">
        <p>Public notes stay on the wall. Private notes stay in your drawer. The hour board writes itself when the clock turns.</p>
      </footer>
    </div>
  );
}
