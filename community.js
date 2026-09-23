const labels = {
  love: "♡ Love",
  interesting: "✧ Interesting",
  inspired: "↗ Inspired",
};
async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error("The connection is unavailable. Please try again.");
  }
  if (!response.ok) throw Error(data.error || "Something went wrong.");
  return data;
}
export function createGuestbook(
  win,
  { endpoint = "/api/guestbook", title, subtitle, request = api } = {},
) {
  const body = document.createElement("section");
  body.className = "guestbook-body";
  body.innerHTML =
    '<h2 class="guestbook-intro">You were here.<small>Say hello. Leave a thought. No account needed.</small></h2><details class="guestbook-compose"><summary>✎ Leave a note</summary><form class="guestbook-form"><label>Your name<input name="name" maxlength="50" required autocomplete="nickname" placeholder="What should I call you?"></label><label>Your note<textarea name="message" maxlength="250" required rows="3" placeholder="A little hello goes a long way."></textarea></label><label class="honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><div class="guestbook-form-bottom"><span class="character-count">0 / 250</span><button type="submit">Leave your note ↗</button></div></form></details><p class="community-status" role="status" aria-live="polite"></p><div class="guestbook-messages" aria-label="Guestbook entries"><p class="empty-state">Opening the guestbook…</p></div><div class="guestbook-pagination"><button class="newer" hidden>← Newer</button><button class="older" hidden>Older →</button></div>';
  if (title) {
    const heading = body.querySelector(".guestbook-intro");
    const small = document.createElement("small");
    small.textContent = subtitle || "";
    heading.replaceChildren(document.createTextNode(title), small);
  }
  win.body.append(body);
  const status = body.querySelector(".community-status"),
    list = body.querySelector(".guestbook-messages"),
    form = body.querySelector("form"),
    send = form.querySelector("button"),
    older = body.querySelector(".older"),
    newer = body.querySelector(".newer");
  const privacy = document.createElement("p");
  privacy.className = "guestbook-privacy";
  privacy.textContent = "Your name, note and timestamp will be public. A browser cookie helps prevent spam. ";
  const policy = document.createElement("a");
  policy.href = "/privacy/";
  policy.target = "_blank";
  policy.rel = "noopener";
  policy.textContent = "Privacy & Cookies ↗";
  policy.setAttribute("aria-label", "Privacy & Cookies (opens in a new tab)");
  privacy.append(policy);
  form.querySelector(".guestbook-form-bottom").before(privacy);
  let cursors = [null],
    page = 0,
    next = null,
    loading = false;
  function render(entries) {
    list.replaceChildren();
    for (const entry of entries) {
      const item = document.createElement("article");
      item.className = "guestbook-message";
      const head = document.createElement("div");
      head.className = "guestbook-message-header";
      const name = document.createElement("strong");
      name.textContent = entry.name;
      const date = document.createElement("time");
      date.dateTime = new Date(entry.created_at).toISOString();
      date.textContent = new Date(entry.created_at).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      date.title = new Date(entry.created_at).toLocaleString(undefined, {
        timeZoneName: "short",
      });
      head.append(name, date);
      const text = document.createElement("p");
      text.textContent = entry.message;
      item.append(head, text);
      list.append(item);
    }
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "A quiet corner, for now. Leave the first hello.";
      list.append(empty);
    }
  }
  async function load() {
    if (loading) return;
    loading = true;
    older.disabled = newer.disabled = true;
    try {
      const query = cursors[page]
        ? "?" + new URLSearchParams(cursors[page])
        : "";
      const data = await request(endpoint + query);
      render(data.entries);
      next = data.next;
      older.hidden = !next;
      newer.hidden = page === 0;
    } catch (e) {
      status.textContent = e.message;
      list.replaceChildren();
      const retry = document.createElement("button");
      retry.textContent = "Try loading again";
      retry.onclick = () => {
        status.textContent = "";
        load();
      };
      list.append(retry);
    } finally {
      loading = false;
      older.disabled = newer.disabled = false;
    }
  }
  older.onclick = () => {
    if (!loading && next) {
      cursors[++page] = next;
      load();
    }
  };
  newer.onclick = () => {
    if (!loading && page > 0) {
      page--;
      load();
    }
  };
  form.elements.message.oninput = () => {
    body.querySelector(".character-count").textContent =
      `${form.elements.message.value.length} / 250`;
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (send.disabled) return;
    send.disabled = true;
    status.textContent = "Sending your note…";
    try {
      await request(endpoint, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      form.reset();
      body.querySelector(".character-count").textContent = "0 / 250";
      body.querySelector("details").open = false;
      status.textContent = "Your note is here. Thanks for stopping by!";
      page = 0;
      cursors = [null];
      await load();
    } catch (e) {
      status.textContent = e.message;
    } finally {
      send.disabled = false;
    }
  };
  load();
}
export async function mountReactions(element) {
  if (element.dataset.mounted) return;
  element.dataset.mounted = "true";
  const slug = element.dataset.reactions;
  const heading = document.createElement("h2");
  heading.textContent = "Leave a little signal.";
  const row = document.createElement("div");
  row.className = "reaction-buttons";
  const status = document.createElement("p");
  status.className = "community-status";
  status.setAttribute("role", "status");
  status.textContent = "Loading reactions…";
  const note = document.createElement("small");
  note.textContent = "One reaction per browser. Click again to take it back.";
  element.append(heading, row, note, status);
  let mine = null;
  const buttons = {};
  function render(data) {
    mine = data.mine;
    for (const [kind, b] of Object.entries(buttons)) {
      b.textContent = `${labels[kind]} · ${data.counts[kind]}`;
      b.setAttribute("aria-pressed", String(mine === kind));
      b.disabled = false;
    }
  }
  for (const [kind, label] of Object.entries(labels)) {
    const b = document.createElement("button");
    b.textContent = label;
    b.disabled = true;
    b.setAttribute("aria-pressed", "false");
    b.onclick = async () => {
      Object.values(buttons).forEach((b) => (b.disabled = true));
      status.textContent = "Saving…";
      try {
        render(
          await api("/api/reactions/" + slug, {
            method: "PUT",
            body: JSON.stringify({ kind: mine === kind ? null : kind }),
          }),
        );
        status.textContent = "Reaction saved.";
      } catch (e) {
        status.textContent = e.message;
        Object.values(buttons).forEach((b) => (b.disabled = false));
      }
    };
    buttons[kind] = b;
    row.append(b);
  }
  async function load() {
    status.textContent = "Loading reactions…";
    try {
      render(await api("/api/reactions/" + slug));
      status.textContent = "";
    } catch (e) {
      status.textContent = e.message + " ";
      const retry = document.createElement("button");
      retry.textContent = "Retry";
      retry.onclick = load;
      status.append(retry);
    }
  }
  await load();
}
