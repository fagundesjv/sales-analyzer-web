"use client";
import { IconAction } from "../src/ui/os/icon-action";
import { useEffect, useRef, useState } from "react";
import { readAttachment } from "../lib/attachments";

export function ConversationAttachment({ file }) {
  const audio = useRef(null);
  const [rate, setRate] = useState(1);
  const [url, setUrl] = useState("");
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!file) return;
    let alive = true;
    let objectUrl;
    readAttachment(file.id)
      .then((blob) => {
        if (!alive) return;
        if (!blob) {
          setMissing(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (alive) setMissing(true);
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file?.id]);
  if (!file) return null;
  if (!url)
    return (
      <small>
        {missing ? "Arquivo indisponível neste navegador" : "Carregando anexo…"}
      </small>
    );
  return (
    <div className="conversation-file">
      {["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        file.type,
      ) && <img src={url} alt={file.name} />}
      {file.type.startsWith("audio/") && (
        <>
          <audio ref={audio} controls preload="metadata" src={url} />
          <IconAction
            type="button"
            aria-label={"Velocidade " + rate + "x; trocar"}
            onClick={() => {
              const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
              audio.current.playbackRate = next;
              setRate(next);
            }}
          >
            {rate}×
          </IconAction>
        </>
      )}
      {file.type.startsWith("video/") && (
        <video
          controls
          preload="metadata"
          style={{ maxWidth: "100%" }}
          src={url}
        />
      )}
      <a href={url} download={file.name}>
        Baixar {file.name}
      </a>
    </div>
  );
}
