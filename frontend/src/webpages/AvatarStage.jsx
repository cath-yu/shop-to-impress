import React, { useEffect, useState } from "react";

const BASE_IMAGES = {
  girl: { primary: "/avatars/basic%20girl.png", fallback: "/avatars/girl.svg" },
  boy: { primary: "/avatars/basic%20guy.png", fallback: "/avatars/boy.svg" },
};

const OVERLAY_PRESETS = {
  top: { width: "58%", top: "34%", left: "50%" },
  bottom: { width: "50%", top: "60%", left: "50%" },
  accessory: { width: "30%", top: "24%", left: "58%" },
};

export default function AvatarStage({
  base = "girl",
  overlayUrl,
  overlayCategory = "top",
  renderUrl,
}) {
  const baseConfig = BASE_IMAGES[base] ?? BASE_IMAGES.girl;
  const [baseUrl, setBaseUrl] = useState(baseConfig.primary);
  const preset = OVERLAY_PRESETS[overlayCategory] ?? OVERLAY_PRESETS.top;

  useEffect(() => {
    setBaseUrl(baseConfig.primary);
  }, [baseConfig.primary]);

  return (
    <div className="avatar-stage">
      {renderUrl ? (
        <img className="avatar-render" src={renderUrl} alt="Rendered avatar" />
      ) : (
        <>
          <img
            className="avatar-base"
            src={baseUrl}
            alt="Base avatar"
            onError={() => setBaseUrl(baseConfig.fallback)}
          />
          {overlayUrl ? (
            <img
              className="avatar-overlay"
              src={overlayUrl}
              alt="Selected outfit"
              style={preset}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
