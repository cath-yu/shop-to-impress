import { useEffect, useMemo, useState } from "react";
import Button from "../components/Button";
import "./MultiPlayerPage.css";

const API_BASE = "/api";

const avatarOptions = [
  { id: "girl", label: "Girl", file: "basic girl.png" },
  { id: "boy", label: "Boy", file: "basic guy.png" },
];

const promptOptions = [
  { id: "summer", label: "Summer Outfit" },
  { id: "fall", label: "Fall Breeze" },
  { id: "school", label: "High School" },
];

const getAvatarSrc = (avatarId) => {
  const match = avatarOptions.find((option) => option.id === avatarId);
  const file = match ? match.file : "basic girl.png";
  return `/avatars/${encodeURIComponent(file)}`;
};

async function fetchJson(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error || "Request failed.";
    throw new Error(message);
  }
  return data;
}

export default function MultiPlayerPage() {
  const [mode, setMode] = useState("lobby");
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("girl");
  const [promptId, setPromptId] = useState(promptOptions[0].id);
  const [items, setItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [renderedImage, setRenderedImage] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  const currentItem = items[currentIndex];
  const avatarSrc = getAvatarSrc(avatar);
  const activePrompt = useMemo(() => {
    return promptOptions.find((option) => option.id === promptId)?.label ?? promptOptions[0].label;
  }, [promptId]);
  const promptText = state?.prompt || activePrompt;

  const players = state?.players ?? [];
  const me = players.find((player) => player.id === playerId);
  const isHost = state?.hostId && state.hostId === playerId;
  const timeRemaining = state?.timeRemaining;
  const phase = state?.phase ?? "waiting";
  const maxPlayers = state?.maxPlayers ?? 2;

  const canPick = phase === "draft" && currentItem && !isRendering;
  const canVote = phase === "vote" && players.length > 1;

  const fetchState = async (activeGameId) => {
    if (!activeGameId) return;
    try {
      const data = await fetchJson(`${API_BASE}/multiplayer/state?gameId=${encodeURIComponent(activeGameId)}`);
      setState(data);
      if (data.items?.length) {
        setItems((prev) => (prev.length ? prev : data.items));
      }
    } catch (error) {
      setStatus(error.message);
    }
  };

  useEffect(() => {
    if (!gameId) return;
    fetchState(gameId);
    const interval = setInterval(() => fetchState(gameId), 2000);
    return () => clearInterval(interval);
  }, [gameId]);

  useEffect(() => {
    if (!state?.promptId) return;
    setPromptId(state.promptId);
  }, [state?.promptId]);

  useEffect(() => {
    if (!me) return;
    if (me.pickedItemId) {
      setSelectedItemId(me.pickedItemId);
    }
    if (me.renderedImage) {
      setRenderedImage(me.renderedImage);
    }
  }, [me]);

  const handleCreate = async () => {
    setIsLoading(true);
    setStatus("");
    try {
      const payload = {
        promptId,
        prompt: activePrompt,
        avatar,
        name: name.trim() || "Player 1",
        limit: 6,
        durationSeconds: 90,
      };
      const data = await fetchJson(`${API_BASE}/multiplayer/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setGameId(data.gameId);
      setPlayerId(data.playerId);
      setState(data.state);
      setItems(data.state?.items ?? []);
      setMode("game");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!gameId.trim()) {
      setStatus("Enter a game ID to join.");
      return;
    }
    setIsLoading(true);
    setStatus("");
    try {
      const payload = {
        gameId: gameId.trim(),
        avatar,
        name: name.trim() || "Player 2",
      };
      const data = await fetchJson(`${API_BASE}/multiplayer/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setGameId(data.gameId);
      setPlayerId(data.playerId);
      setState(data.state);
      setItems(data.state?.items ?? []);
      setMode("game");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShufflePrompt = () => {
    const next = promptOptions[Math.floor(Math.random() * promptOptions.length)].id;
    setPromptId(next);
  };

  const handleNextItem = () => {
    if (!items.length) return;
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const handlePick = async () => {
    if (!currentItem) return;
    setIsRendering(true);
    setStatus("");
    try {
      const render = await fetchJson(`${API_BASE}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: currentItem.id,
          avatar,
          baseImage: renderedImage || null,
        }),
      });
      const renderedUrl = render.renderedImage;
      setRenderedImage(renderedUrl);
      setSelectedItemId(currentItem.id);
      const stateUpdate = await fetchJson(`${API_BASE}/multiplayer/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          playerId,
          itemId: currentItem.id,
          renderedImage: renderedUrl,
        }),
      });
      setState(stateUpdate);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsRendering(false);
    }
  };

  const handleStart = async () => {
    if (!gameId || !playerId) return;
    setIsLoading(true);
    setStatus("");
    try {
      const stateUpdate = await fetchJson(`${API_BASE}/multiplayer/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, playerId }),
      });
      setState(stateUpdate);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (targetId) => {
    setIsLoading(true);
    setStatus("");
    try {
      const stateUpdate = await fetchJson(`${API_BASE}/multiplayer/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          playerId,
          voteFor: targetId,
        }),
      });
      setState(stateUpdate);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPreview = useMemo(() => {
    if (renderedImage) return renderedImage;
    return avatarSrc;
  }, [renderedImage, avatarSrc]);

  return (
    <div className="multiplayer-page">
      <header className="mp-header">
        <div>
          <h1>Dress to Impress</h1>
          <p className="mp-subtitle">Multiplayer match</p>
        </div>
        {gameId ? (
          <div className="mp-meta">
            <div className="mp-meta-row">
              <span>Game ID</span>
              <strong>{gameId}</strong>
            </div>
            <div className="mp-meta-row">
              <span>Phase</span>
              <strong>{phase}</strong>
            </div>
          </div>
        ) : null}
      </header>

      {mode === "lobby" ? (
        <section className="mp-lobby">
          <div className="mp-card">
            <h2>Create game</h2>
            <label className="mp-label">
              Display name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </label>
            <div className="mp-prompt">
              <div>
                <span>Prompt</span>
                <strong>{promptText}</strong>
              </div>
              <button type="button" className="mp-secondary" onClick={handleShufflePrompt}>
                Shuffle prompt
              </button>
            </div>
            <div className="mp-avatar-row">
              {avatarOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`mp-avatar-choice ${avatar === option.id ? "active" : ""}`}
                  onClick={() => setAvatar(option.id)}
                >
                  <img src={getAvatarSrc(option.id)} alt={option.label} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            <Button style="primary" disabled={isLoading} onClick={handleCreate}>
              {isLoading ? "Starting..." : "Start game"}
            </Button>
          </div>

          <div className="mp-card">
            <h2>Join game</h2>
            <label className="mp-label">
              Game ID
              <input value={gameId} onChange={(e) => setGameId(e.target.value)} placeholder="abc123" />
            </label>
            <label className="mp-label">
              Display name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </label>
            <div className="mp-avatar-row">
              {avatarOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`mp-avatar-choice ${avatar === option.id ? "active" : ""}`}
                  onClick={() => setAvatar(option.id)}
                >
                  <img src={getAvatarSrc(option.id)} alt={option.label} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            <Button style="primary" disabled={isLoading} onClick={handleJoin}>
              {isLoading ? "Joining..." : "Join game"}
            </Button>
          </div>
        </section>
      ) : (
        <section className="mp-stage">
          <div className="mp-preview">
            <div className="mp-preview-card">
              <img src={renderPreview} alt="Your avatar preview" />
            </div>
            <div className="mp-theme">
              <span>Theme</span>
              <strong>{promptText}</strong>
            </div>
            <div className="mp-status">
              <div>
                <span>Timer</span>
                <strong>{timeRemaining == null ? "--" : `${timeRemaining}s`}</strong>
              </div>
              <div>
                <span>Your pick</span>
                <strong>{renderedImage ? "Updated" : "None"}</strong>
              </div>
              <div>
                <span>Players</span>
                <strong>{players.length}/{maxPlayers}</strong>
              </div>
            </div>
          </div>

          <div className="mp-panel">
            {phase === "waiting" ? (
              <div className="mp-card mp-center">
                <h2>Lobby</h2>
                <p>Players joined: {players.length}/{maxPlayers}</p>
                <p>{isHost ? "Start when everyone is ready." : "Waiting for the host to start."}</p>
                {isHost ? (
                  <Button style="primary" disabled={isLoading || players.length < 2} onClick={handleStart}>
                    {isLoading ? "Starting..." : "Start match"}
                  </Button>
                ) : null}
              </div>
            ) : null}

            {phase === "draft" ? (
              <div className="mp-card">
                <h2>Choose your look</h2>
                {currentItem ? (
                  <>
                    <div className="mp-item">
                      <img src={currentItem.previewImage || currentItem.imageUrl} alt={currentItem.name} />
                      <div>
                        <h3>{currentItem.name}</h3>
                        <p>{currentItem.store}</p>
                        {currentItem.productUrl ? (
                          <a href={currentItem.productUrl} target="_blank" rel="noreferrer">
                            View product
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className="mp-actions">
                      <button type="button" className="mp-secondary" onClick={handleNextItem}>
                        Next item
                      </button>
                      <Button style="primary" disabled={!canPick} onClick={handlePick}>
                        {isRendering ? "Rendering..." : "Put it on"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p>No items yet.</p>
                )}
              </div>
            ) : null}

            {phase === "vote" || phase === "done" ? (
              <div className="mp-card">
                <h2>Vote on the best outfit</h2>
                <div className="mp-vote-grid">
                  {players.map((player) => (
                    <div key={player.id} className="mp-vote-card">
                      <img
                        src={player.renderedImage || getAvatarSrc(player.avatar)}
                        alt={player.name || "Player"}
                      />
                      <strong>{player.name || "Player"}</strong>
                      {phase === "vote" ? (
                        <button
                          type="button"
                          className="mp-secondary"
                          disabled={!canVote || player.id === playerId || isLoading}
                          onClick={() => handleVote(player.id)}
                        >
                          Vote
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {phase === "done" ? (
                  <div className="mp-result">
                    {state?.tie ? (
                      <p>Its a tie.</p>
                    ) : (
                      <p>Winner: {players.find((player) => player.id === state?.winner)?.name || "Player"}</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      )}

      {status ? <p className="mp-error">{status}</p> : null}
    </div>
  );
}
