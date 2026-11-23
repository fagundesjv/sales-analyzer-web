"use client";
import {useEffect, useState} from "react";
import {v2Request} from "../../lib/v2-client";

const pollDelay = 700;
const retryDelays = [700, 1400, 2800];
const inProgress = job => job?.status === "queued" || job?.status === "running";

function isTemporary(error) {
  if (error.status) return [502, 503, 504].includes(error.status) && error.code !== "stale_context";
  return error.code === "network_error";
}

export function useDiagnosticRun(selection, context) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!selection?.id || selection.context !== context) return;
    const {id} = selection;
    const controller = new AbortController();
    const scope = {selection, context, attempt};
    let lastRun = selection.job?.id === id ? selection.job : null;
    let failures = 0;
    let timer;

    async function read() {
      try {
        const data = await v2Request("diagnostics/" + id, {context, signal:controller.signal});
        if (controller.signal.aborted) return;
        if (data?.id !== id) throw new Error("Não foi possível conferir o diagnóstico solicitado.");
        lastRun = data;
        failures = 0;
        setState({...scope, data});
        if (inProgress(data)) timer = setTimeout(read, pollDelay);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (inProgress(lastRun) && isTemporary(error) && failures < retryDelays.length) {
          setState({...scope, data:lastRun, reconnecting:true});
          timer = setTimeout(read, retryDelays[failures++]);
        } else {
          setState({...scope, error});
        }
      }
    }

    read();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selection, context, attempt]);

  const current = state?.selection === selection && state.context === context && state.attempt === attempt;
  return {...(current ? state : {loading:true}), retry:() => setAttempt(n => n + 1)};
}
