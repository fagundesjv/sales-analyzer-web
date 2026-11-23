"use client";
import { useCallback, useEffect, useRef, useState } from "react";
const ATTENDANCE_FILE_LIMIT = 16 * 1024 * 1024;
/** An embedding page that does not delegate the microphone (iframe without allow="microphone"): the person cannot fix it. */
function microphoneBlockedByPage() {
    try {
        const policy = document.permissionsPolicy ?? document.featurePolicy;
        return policy?.allowsFeature("microphone") === false;
    }
    catch {
        return false;
    }
}
/** Recording is always a draft. Stopping or granting microphone permission never transmits it. */
export function useVoiceRecording(onFile, onError) {
    const [recording, setRecording] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const discard = useRef(false);
    const recorder = useRef(null);
    const mounted = useRef(true);
    const stopTimer = useRef(null);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            if (stopTimer.current)
                clearTimeout(stopTimer.current);
            const current = recorder.current;
            if (current) {
                current.onstop = null;
                if (current.state !== "inactive")
                    current.stop();
                current.stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);
    useEffect(() => {
        if (!recording)
            return;
        const started = Date.now();
        const clock = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
        return () => clearInterval(clock);
    }, [recording]);
    async function start() {
        if (recorder.current || requesting)
            return;
        setRequesting(true);
        let stream = null;
        try {
            if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
                throw new Error("Use um navegador com microfone ou anexe um arquivo de áudio.");
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (!mounted.current) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            const mime = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
            const current = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
            discard.current = false;
            recorder.current = current;
            const chunks = [];
            let bytes = 0;
            current.ondataavailable = (event) => {
                bytes += event.data.size;
                chunks.push(event.data);
                if (bytes >= ATTENDANCE_FILE_LIMIT && current.state !== "inactive")
                    current.stop();
            };
            current.onerror = () => { if (mounted.current)
                onError("Não foi possível gravar. Tente novamente ou anexe um áudio."); };
            current.onstop = () => {
                current.stream.getTracks().forEach((track) => track.stop());
                recorder.current = null;
                if (stopTimer.current)
                    clearTimeout(stopTimer.current);
                if (!mounted.current)
                    return;
                setRecording(false);
                if (discard.current) {
                    discard.current = false;
                    return;
                }
                if (!bytes || bytes > ATTENDANCE_FILE_LIMIT) {
                    onError("A gravação está vazia ou passou de 16 MB.");
                    return;
                }
                const type = current.mimeType.split(";")[0] || "audio/webm";
                onFile(new File(chunks, `audio-${Date.now()}.${type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm"}`, { type }));
            };
            current.start(1000);
            setSeconds(0);
            setRecording(true);
            stopTimer.current = setTimeout(() => { if (current.state !== "inactive")
                current.stop(); }, 5 * 60 * 1000);
        }
        catch (cause) {
            stream?.getTracks().forEach((track) => track.stop());
            if (mounted.current)
                onError(cause instanceof Error && cause.name !== "NotAllowedError" ? cause.message
                    : microphoneBlockedByPage() ? "O microfone não está liberado nesta página. Anexe um arquivo de áudio ou peça ao suporte do sistema para liberar o microfone."
                        : "Permita o microfone no navegador para gravar um áudio.");
        }
        finally {
            if (mounted.current)
                setRequesting(false);
        }
    }
    const stop = useCallback(() => { if (recorder.current?.state === "recording")
        recorder.current.stop(); }, []);
    const cancel = useCallback(() => { discard.current = true; if (recorder.current?.state === "recording")
        recorder.current.stop(); }, []);
    return { recording, requesting, seconds, start, stop, cancel };
}
