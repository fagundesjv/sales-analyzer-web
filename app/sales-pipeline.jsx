"use client";

import { useState } from "react";
import {
  Button,
  ButtonLink,
  PageHeader,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import { ArrowUpRight, LayoutGrid, Columns3, MessageCircle } from "lucide-react";
import { ProductVisual } from "./product-visual";
import { contactsOf } from "../lib/operation";
import { kindOf, money } from "../lib/operation";
import { ContactMark } from "./recovery-desk";
import { ClosedDealCards } from "./negotiations";
import styles from "./recovery-desk.module.css";

const defaultPipeline = {
  id: "principal",
  name: "Comercial",
  stages: ["Proposta", "Follow-up", "Negociação"],
};
const startingStage = { rafael: "Follow-up", marina: "Negociação" };

export function SalesPipeline({ ops, change }) {
  const signals = contactsOf(ops);

  const pipelines = ops.pipelines || [defaultPipeline];
  const [selected, setSelected] = useState("principal");
  const pipeline = pipelines.find((p) => p.id === selected) || pipelines[0];
  const originOf = (s) => ops.dealPipelines?.[s.id] || "principal";
  const stageOf = (s) => {
    const value = ops.stage[s.id] || startingStage[s.id];
    return pipeline.stages.includes(value) ? value : pipeline.stages[0];
  };
  const [editor, setEditor] = useState(null);
  const [attributeForm, setAttributeForm] = useState(null);
  const [moving, setMoving] = useState(null);
  const [destination, setDestination] = useState("");
  const [newStage, setNewStage] = useState("");
  const [owner, setOwner] = useState("Todos");
  const [limits, setLimits] = useState({});
  const contacts = signals.filter(
    (s) =>
      originOf(s) === pipeline.id && (owner === "Todos" || s.owner === owner),
  );
  const active = contacts.filter((s) => kindOf(s, ops) === "risk");
  const closed = contacts.filter((s) => kindOf(s, ops) !== "risk");
  return (
    <div className={styles.desk}>
      <PageHeader
        title="Pipeline comercial"
        description="Acompanhe cada negociação, da proposta ao desfecho."
        actions={
          <ButtonLink href="#tarefas" icon={MessageCircle}>
            Retornos agendados
          </ButtonLink>
        }
      />
      <div className="actions">
        <select
          className="sales-select"
          aria-label="Funil"
          value={pipeline.id}
          onChange={(e) => setSelected(e.target.value)}
        >
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          onClick={() =>
            setEditor({
              ...pipeline,
              fields: pipeline.fields || [],
              stages: pipeline.stages.map((name) => ({ original: name, name })),
            })
          }
        >
          Editar funil
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setEditor({
              id: "",
              name: "",
              fields: [],
              stages: defaultPipeline.stages.map((name) => ({ name })),
            })
          }
        >
          Novo funil
        </Button>
      </div>
      <div className={styles.boardControls}>
        <div className={styles.filter} aria-label="Visualização do pipeline">
          {[
            [Columns3, "board", "Quadro"],
            [LayoutGrid, "list", "Negociações"],
          ].map(([Icon, k, label]) => (
            <a
              key={k}
              href={k === "list" ? "#oportunidades" : "#crm"}
              aria-current={k === "board" ? "page" : undefined}
            >
              <Icon size={14} />
              {label}
            </a>
          ))}
        </div>
        <select
          className="sales-select"
          aria-label="Filtrar pipeline por responsável"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          {["Todos", ...new Set(signals.map((s) => s.owner))].map((n) => (
            <option key={n} value={n}>
              {n === "Todos" ? "Toda a equipe" : n}
            </option>
          ))}
        </select>
      </div>
      {
        <div className={styles.board}>
          {pipeline.stages.map((stage, i) => {
            const laneKey = JSON.stringify([pipeline.id, stage, owner]);
            const limit = limits[laneKey] || 8;
            const items = active.filter((s) => stageOf(s) === stage);
            return (
              <section key={stage} className={styles.lane} aria-label={stage}>
                <div className={styles.laneTitle}>
                  <i data-stage={i} />
                  <h2>{stage}</h2>
                  <small>{items.length}</small>
                </div>
                <div className={styles.laneValue}>
                  {money(items.reduce((sum, s) => sum + (s.cents || 0), 0))}{" "}
                  <small>em valores citados</small>
                </div>
                {items.slice(0, limit).map((s) => (
                  <article className={styles.deal} key={s.id}>
                    <div className={styles.dealArt}>
                      <ProductVisual contact={s} />
                    </div>
                    <a href={"#conversa/" + s.id}>
                      <span className={styles.contact}>
                        <ContactMark s={s} />
                        <b>{s.name}</b>
                      </span>
                      <ArrowUpRight size={14} />
                    </a>
                    <p>{s.title}</p>
                    <strong>
                      {s.cents ? money(s.cents) : "Valor a apurar"}
                    </strong>
                    <div className={styles.dealFoot}>
                      <small>{s.owner}</small>
                      <select
                        value={stage}
                        aria-label={"Etapa de " + s.name}
                        onChange={(e) =>
                          change({
                            stage: { ...ops.stage, [s.id]: e.target.value },
                          })
                        }
                      >
                        {pipeline.stages.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </div>
                    {!!pipeline.fields?.length && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setAttributeForm({
                            contact: s,
                            values: ops.dealFields?.[s.id] || {},
                          })
                        }
                      >
                        Dados da negociação
                      </Button>
                    )}
                    {pipelines.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const target = pipelines.find(
                            (p) => p.id !== pipeline.id,
                          );
                          setMoving(s);
                          setDestination(target.id);
                          setNewStage(target.stages[0]);
                        }}
                      >
                        Mover de funil
                      </Button>
                    )}
                  </article>
                ))}
                {items.length > limit && <Button variant="ghost" size="sm"
                  onClick={() => setLimits(previous => ({...previous, [laneKey]:limit + 8}))}>
                  Mostrar mais {Math.min(8, items.length-limit)} negociações
                </Button>}
                {!items.length && (
                  <p className={styles.empty}>
                    Nenhuma negociação nesta etapa.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      }
      {editor && (
        <ResponsiveDialog
          footer={
            <Button
              form="editar-funil"
              type="submit"
              variant="primary"
              disabled={
                !editor.name.trim() ||
                editor.fields.some((f) => !f.label.trim()) ||
                editor.stages.some((s) => !s.name.trim()) ||
                new Set(editor.stages.map((s) => s.name.trim().toLowerCase()))
                  .size !== editor.stages.length
              }
            >
              {" "}
              Salvar funil{" "}
            </Button>
          }
          open
          title={editor.id ? "Editar funil" : "Novo funil"}
          onClose={() => setEditor(null)}
        >
          <form
            id="editar-funil"
            className="op-form"
            onSubmit={(e) => {
              e.preventDefault();
              const stages = editor.stages.map((s) => s.name.trim());
              const edited = {
                id: editor.id || crypto.randomUUID(),
                name: editor.name.trim(),
                stages,
                fields: editor.fields,
              };
              const stage = { ...ops.stage };
              if (editor.id)
                for (const contact of signals.filter(
                  (s) => originOf(s) === editor.id,
                )) {
                  const previous = stageOf(contact);
                  stage[contact.id] =
                    editor.stages
                      .find((s) => s.original === previous)
                      ?.name.trim() || stages[0];
                }
              change({
                pipelines: editor.id
                  ? pipelines.map((p) => (p.id === editor.id ? edited : p))
                  : [...pipelines, edited],
                stage,
              });
              setSelected(edited.id);
              setEditor(null);
            }}
          >
            <label className="op-field">
              Nome do funil
              <input
                required
                maxLength={60}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </label>
            {editor.stages.map((stage, i) => (
              <label key={i} className="op-field">
                Etapa {i + 1}
                <input
                  required
                  maxLength={40}
                  value={stage.name}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      stages: editor.stages.map((s, j) =>
                        i === j ? { ...s, name: e.target.value } : s,
                      ),
                    })
                  }
                />
              </label>
            ))}
            {editor.fields.map((field, i) => (
              <label className="op-field" key={field.id}>
                Campo adicional {i + 1}
                <input
                  required
                  maxLength={60}
                  value={field.label}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      fields: editor.fields.map((f) =>
                        f.id === field.id ? { ...f, label: e.target.value } : f,
                      ),
                    })
                  }
                />
              </label>
            ))}
            <Button
              type="button"
              size="sm"
              onClick={() =>
                setEditor({
                  ...editor,
                  fields: [
                    ...editor.fields,
                    { id: crypto.randomUUID(), label: "" },
                  ],
                })
              }
            >
              Adicionar campo de texto
            </Button>
            <div className="actions">
              <Button
                type="button"
                onClick={() =>
                  setEditor({
                    ...editor,
                    stages: [...editor.stages, { name: "" }],
                  })
                }
              >
                Adicionar etapa
              </Button>
            </div>
          </form>
        </ResponsiveDialog>
      )}
      {attributeForm && (
        <ResponsiveDialog
          footer={
            <Button form="dados-negociacao" type="submit" variant="primary">
              {" "}
              Salvar dados{" "}
            </Button>
          }
          open
          title={"Dados de " + attributeForm.contact.name}
          onClose={() => setAttributeForm(null)}
        >
          <form
            id="dados-negociacao"
            className="op-form"
            onSubmit={(e) => {
              e.preventDefault();
              change({
                dealFields: {
                  ...ops.dealFields,
                  [attributeForm.contact.id]: attributeForm.values,
                },
              });
              setAttributeForm(null);
            }}
          >
            {pipeline.fields.map((field) => (
              <label key={field.id} className="op-field">
                {field.label}
                <input
                  maxLength={300}
                  value={attributeForm.values[field.id] || ""}
                  onChange={(e) =>
                    setAttributeForm({
                      ...attributeForm,
                      values: {
                        ...attributeForm.values,
                        [field.id]: e.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
          </form>
        </ResponsiveDialog>
      )}
      {moving && (
        <ResponsiveDialog
          footer={
            <Button form="mover-negociacao" type="submit" variant="primary">
              {" "}
              Confirmar mudança{" "}
            </Button>
          }
          open
          title={"Mover " + moving.name}
          onClose={() => setMoving(null)}
        >
          <form
            id="mover-negociacao"
            className="op-form"
            onSubmit={(e) => {
              e.preventDefault();
              change(
                {
                  dealPipelines: {
                    ...ops.dealPipelines,
                    [moving.id]: destination,
                  },
                  stage: { ...ops.stage, [moving.id]: newStage },
                },
                {
                  kind: "Negociação movida",
                  contact: moving.id,
                  detail:
                    pipelines.find((p) => p.id === destination).name +
                    " · " +
                    newStage,
                },
              );
              setSelected(destination);
              setMoving(null);
            }}
          >
            <label className="op-field">
              Funil de destino
              <select
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setNewStage(
                    pipelines.find((p) => p.id === e.target.value).stages[0],
                  );
                }}
              >
                {pipelines
                  .filter((p) => p.id !== pipeline.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="op-field">
              Etapa de destino
              <select
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
              >
                {pipelines
                  .find((p) => p.id === destination)
                  ?.stages.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </label>
          </form>
        </ResponsiveDialog>
      )}
      <section className={styles.queue}>
        <h2 className={styles.subhead}>Desfechos registrados</h2>
        <ClosedDealCards ops={ops} items={closed} />
      </section>
    </div>
  );
}
