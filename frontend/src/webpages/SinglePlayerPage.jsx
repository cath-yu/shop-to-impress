import { useEffect, useMemo, useState } from 'react';
import './SinglePlayerPage.css';
import AvatarStage from "./AvatarStage";
import ProductCard from '../components/ProductCard';

export default function SinglePlayerPage() {
  const [items, setItems] = useState([]);
  const [dismissedIds, setDismissedIds] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [equippedId, setEquippedId] = useState(null);
  const [status, setStatus] = useState("loading");
  const [avatar, setAvatar] = useState("girl");
  const [renderingId, setRenderingId] = useState(null);
  const [renderError, setRenderError] = useState(null);

  useEffect(() => {
    fetch("/api/preload?limit=3", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.items?.length) {
          setStatus("generating");
        }
      })
      .catch(() => {
        setStatus("offline");
      });
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let intervalId;

    const tick = async () => {
      if (inFlight || !active) return;
      inFlight = true;
      try {
        const catalogRes = await fetch("/attachments/catalog.json", { cache: "no-store" });
        const catalog = catalogRes.ok ? await catalogRes.json() : [];

        if (!active) return;
        setItems(Array.isArray(catalog) ? catalog : []);
        if (Array.isArray(catalog) && catalog.length > 0) {
          const pending = catalog.some((item) => item.status !== "ready" && item.status !== "error");
          setStatus(pending ? "generating" : "ready");
          if (!pending && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        } else {
          setStatus("loading");
        }
      } catch {
        if (active) setStatus("offline");
      } finally {
        inFlight = false;
      }
    };

    tick();
    intervalId = setInterval(tick, 8000);
    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const queue = useMemo(
    () => items.filter((item) => !dismissedIds.includes(item.id)),
    [items, dismissedIds],
  );

  const current = queue[cursor] ?? null;
  const isRendering = renderingId === current?.id;
  const equippedItem = items.find((item) => item.id === equippedId) ?? null;
  const renderUrl = equippedItem?.renderedImages?.[avatar];
  const overlayUrl = (!renderUrl && !isRendering)
    ? (equippedItem?.previewImage || equippedItem?.imageUrl)
    : null;
  const overlayCategory = equippedItem?.category || "top";
  const isCurrentReady = current?.status === "ready";

  const advanceCursor = () => {
    setCursor((prev) => prev + 1);
  };

  useEffect(() => {
    if (cursor >= queue.length) {
      setCursor(Math.max(queue.length - 1, 0));
    }
  }, [queue.length, cursor]);

  const handleDiscard = () => {
    if (!current) return;
    setRenderError(null);
    setDismissedIds((prev) => [...prev, current.id]);
    setCursor((prev) => {
      const next = prev >= queue.length - 1 ? Math.max(queue.length - 2, 0) : prev;
      return next;
    });
  };

  const handleWear = async () => {
    if (!isCurrentReady || !current) return;
    setEquippedId(current.id);
    setRenderError(null);
    if (current.renderedImages?.[avatar]) {
      advanceCursor();
      return;
    }
    setRenderingId(current.id);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: current.id, avatar }),
      });
      const data = res.ok ? await res.json() : null;
      if (!res.ok) {
        throw new Error(data?.error || "Render failed.");
      }
      if (data?.renderedImage) {
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== current.id) return item;
            const renderedImages = { ...(item.renderedImages || {}) };
            renderedImages[avatar] = data.renderedImage;
            return { ...item, renderedImages };
          }),
        );
      }
    } catch (err) {
      setRenderError(err.message);
    } finally {
      setRenderingId(null);
    }
    setDismissedIds((prev) => [...prev, current.id]);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        handleDiscard();
      }

      if (e.key === "ArrowRight") {
        handleWear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDiscard, handleWear]);

  return (
    <div className="singleplayer-page">
      <div className="page-header">
        <h1>Shop to Impress</h1>
        <div className="avatar-toggle">
          <button
            type="button"
            className={avatar === "girl" ? "active" : ""}
            onClick={() => setAvatar("girl")}
          >
            Girl
          </button>
          <button
            type="button"
            className={avatar === "boy" ? "active" : ""}
            onClick={() => setAvatar("boy")}
          >
            Boy
          </button>
        </div>
      </div>

      <div className="singleplayer-layout">
        <AvatarStage
          base={avatar}
          overlayUrl={overlayUrl}
          overlayCategory={overlayCategory}
          renderUrl={renderUrl}
        />

        <div className="singleplayer-page-cards">
          {current ? <ProductCard
            name={current.name}
            store={current.productUrl}
            image={current.previewImage || current.imageUrl}
            onDislike={handleDiscard}
            onLike={handleWear}
          /> : 
          <p className="empty-state">No more items.</p>}
      </div>

        {/* <div className="product-card">
          <div className="product-header">
            <span className="product-status">
              {status === "loading" && "Loading products..."}
              {status === "generating" && "Downloading images..."}
              {status === "ready" && "Ready to try"}
              {status === "offline" && "Backend offline"}
            </span>
          </div>
          {renderError ? <p className="empty-state">{renderError}</p> : null}
          {current ? (
            <>
              <img
                className="product-image"
                src={current.previewImage || current.imageUrl}
                alt={current.name}
              />
              <div className="product-info">
                <h3>{current.name}</h3>
                <p>{current.store}</p>
                {current.productUrl && (
                  <a href={current.productUrl} target="_blank" rel="noreferrer">
                    View product
                  </a>
                )}
              </div>
              <div className="product-actions">
                <button type="button" className="ghost" onClick={handleDiscard}>
                  Discard
                </button>
                <button type="button" onClick={handleWear} disabled={!isCurrentReady || isRendering}>
                  {isRendering ? "Generating..." : (isCurrentReady ? "Put it on" : "Downloading...")}
                </button>
              </div>
              <button
                type="button"
                className="next-button"
                onClick={handleNext}
                disabled={queue.length <= 1}
              >
                Next item
              </button>
            </>
          ) : (
            <p className="empty-state">No items loaded yet.</p>
          )}
        </div> */}

      </div>
    </div>
  );
}
