"use client";
import { useState } from "react";
import { Button, SwitchRow } from "@content-ventures/design-system/v3";
import { Building2, MessageCircle } from "lucide-react";
import {
  Field,
  LinePhoneField,
  OfficeHours,
  MaskedIdentifier,
  linePhoneKey,
} from "./operation-fields";
import { portalEnabled } from "../lib/official-portal";
import { formatCnpj, isValidCnpj } from "../lib/official/cnpj";
const states =
  "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(
    " ",
  );
const formatZip = value => value.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
export function CompanySettings({ ops, change, notify }) {
  const paired = ops.lines.filter(line => line.paired).length;
  const connections = [
    !portalEnabled && paired > 0 && (paired === 1 ? "1 WhatsApp conectado" : paired + " WhatsApps conectados"),
    ops.sources.nowz && "Nowz / Helena",
    ops.sources.datacrazy && "DataCrazy",
  ].filter(Boolean);
  function showError(input, message) {
    const details = input.closest("details");
    if (details) details.open = true;
    if (message) input.setCustomValidity(message);
    input.reportValidity();
    input.focus();
  }
  const [profile, setProfile] = useState(ops.profile);
  const [hoursRevision, resetHours] = useState(0);
  const changed = Object.keys(profile).some(
    (key) => profile[key] !== ops.profile[key],
  );
  return (
    <form
      className="settings-profile"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fields = e.currentTarget.elements;
        const invalid = Array.from(fields).find(field => field.willValidate && !field.validity.valid);
        if (invalid) return showError(invalid);
        if (!profile.name.trim()) return showError(fields.companyName, "Informe o nome da empresa.");
        if (!profile.hours.trim()) return showError(fields.hoursDescription, "Informe os dias ou horários de atendimento.");
        const next = {
          ...profile,
          name: profile.name.trim(),
          hours: profile.hours.trim(),
        };
        if (profile.cnpj && !isValidCnpj(profile.cnpj)) {
          showError(fields.cnpj, "Informe um CNPJ válido.");
          return;
        }
        for (const key of ["website", "facebook", "linkedin"]) {
          const website = profile[key]?.trim();
          if (!website) continue;
          try {
            const url = new URL(
              /^[a-z]+:/i.test(website) ? website : "https://" + website,
            );
            if (
              !["http:", "https:"].includes(url.protocol) ||
              !url.hostname.includes(".") ||
              url.username ||
              url.password
            )
              throw new Error();
            next[key] = url.href.replace(/\/$/, "");
          } catch {
            showError(fields[key], "Informe um endereço de site válido.");
            return;
          }
        }
        const instagram = profile.instagram?.trim();
        if (instagram) {
          const handle = instagram
            .replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, "")
            .replace(/\/$/, "")
            .replace(/^@/, "");
          if (!/^[a-z0-9._]{1,30}$/i.test(handle)) {
            showError(fields.instagram, "Informe o @ ou o endereço do perfil do Instagram.");
            return;
          }
          next.instagram = "@" + handle;
        }
        if (profile.phone && !linePhoneKey(profile.phone)) {
          showError(fields.phone, "Informe o número com DDD.");
          return;
        }
        if (profile.phone) next.phone = linePhoneKey(profile.phone);
        change({ profile: next });
        setProfile(next);
        notify("Configuração salva.");
      }}
    >
      <fieldset data-area="profile" aria-labelledby="company-profile-heading">
        <div className="settings-group-title">
          <Building2 size={19} aria-hidden="true" />
          <h2 id="company-profile-heading">Dados da empresa</h2>
        </div>
        <Field label="Nome da empresa">
          <input
            required
            name="companyName"
            autoComplete="organization"
            value={profile.name}
            onChange={(e) => { e.target.setCustomValidity(""); setProfile({ ...profile, name: e.target.value }); }}
          />
        </Field>
        <Field label="Segmento">
          <input
            maxLength={80}
            value={profile.industry || ""}
            onChange={(e) =>
              setProfile({ ...profile, industry: e.target.value })
            }
          />
        </Field>
        <Field label="Cidade da sede">
          <input
            autoComplete="address-level2"
            maxLength={100}
            value={profile.city || ""}
            onChange={(e) => setProfile({ ...profile, city: e.target.value })}
          />
        </Field>
        <OfficeHours
          key={hoursRevision}
          value={profile.hours}
          onChange={(hours) => setProfile({ ...profile, hours })}
        />
        <div className="company-sources">
          <span>Conexões da empresa</span>
          {connections.length ? connections.join(" · ") : portalEnabled ? "Consulte os canais da operação." : "Nenhuma conexão ativa"}
          {portalEnabled && <a href="#whatsapps">Ver números do portal</a>}
        </div>
        <details className="company-more">
          <summary>Identificação e endereço</summary>
          <div>
            <Field label="CNPJ">
              <MaskedIdentifier
                limit={14}
                format={formatCnpj}
                characters={/[a-z0-9]/i}
                name="cnpj"
                autoCapitalize="characters"
                spellCheck={false}
                value={profile.cnpj || ""}
                placeholder="00.000.000/0000-00"
                onValueChange={cnpj => setProfile({ ...profile, cnpj })}
              />
            </Field>
            <Field label="CEP">
              <MaskedIdentifier
                limit={8}
                format={formatZip}
                characters={/[0-9]/}
                name="zip"
                inputMode="numeric"
                autoComplete="postal-code"
                pattern="[0-9]{5}-[0-9]{3}"
                title="Informe os oito números do CEP"
                placeholder="00000-000"
                value={profile.zip || ""}
                onValueChange={zip => setProfile({ ...profile, zip })}
              />
            </Field>
            <Field label="Rua, número e complemento">
              <input
                autoComplete="street-address"
                maxLength={160}
                value={profile.address || ""}
                onChange={(e) =>
                  setProfile({ ...profile, address: e.target.value })
                }
              />
            </Field>
            <Field label="Estado">
              <select
                autoComplete="address-level1"
                value={profile.state || ""}
                onChange={(e) =>
                  setProfile({ ...profile, state: e.target.value })
                }
              >
                <option value="">Selecionar UF</option>
                {states.map((uf) => (
                  <option key={uf}>{uf}</option>
                ))}
              </select>
            </Field>
            <Field label="O que a empresa faz">
              <textarea
                rows={3}
                maxLength={800}
                value={profile.about || ""}
                onChange={(e) =>
                  setProfile({ ...profile, about: e.target.value })
                }
              />
            </Field>
          </div>
        </details>
      </fieldset>
      <fieldset data-area="contact" aria-labelledby="company-contacts">
        <div className="settings-group-title">
          <MessageCircle size={19} aria-hidden="true" />
          <h2 id="company-contacts">Presença e contato</h2>
        </div>
        <Field label="Website">
          <input
            name="website"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={250}
            placeholder="empresa.com.br"
            value={profile.website || ""}
            onChange={(e) => {
              e.target.setCustomValidity("");
              setProfile({ ...profile, website: e.target.value });
            }}
          />
        </Field>
        <Field label="Instagram">
          <input
            name="instagram"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={120}
            placeholder="@empresa"
            value={profile.instagram || ""}
            onChange={(e) => {
              e.target.setCustomValidity("");
              setProfile({ ...profile, instagram: e.target.value });
            }}
          />
        </Field>
        <Field label="E-mail comercial">
          <input
            type="email"
            autoComplete="email"
            maxLength={150}
            value={profile.email || ""}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
          />
        </Field>
        <Field label="Telefone comercial">
          <LinePhoneField
            name="phone"
            required={false}
            value={profile.phone || ""}
            onValueChange={(phone) => setProfile({ ...profile, phone })}
          />
        </Field>
        <details className="company-more">
          <summary>Outras redes sociais</summary>
          <div>
            {[
              ["facebook", "Facebook"],
              ["linkedin", "LinkedIn"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  name={key}
                  inputMode="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={200}
                  value={profile[key] || ""}
                  onChange={(e) => {
                    e.target.setCustomValidity("");
                    setProfile({ ...profile, [key]: e.target.value });
                  }}
                />
              </Field>
            ))}
          </div>
        </details>
      </fieldset>
      <fieldset data-area="zoe" aria-labelledby="company-analysis-heading">
        <div className="settings-group-title">
          <img src="/assets/idle_thumbnail.png" width="24" height="24" alt="" />
          <h2 id="company-analysis-heading">Análise da Zoe</h2>
        </div>
        <Field label="Frequência de leitura da Zoe">
          <select
            value={profile.cadence}
            onChange={(e) =>
              setProfile({ ...profile, cadence: e.target.value })
            }
          >
            {[5, 10, 15, 30, 60, 120, 360, 720, 1440].map((n) => (
              <option key={n} value={n}>
                A cada {n} min
              </option>
            ))}
          </select>
        </Field>
        <Field label="Janela de análise">
          <select
            value={profile.window}
            onChange={(e) => setProfile({ ...profile, window: e.target.value })}
          >
            {[7, 15, 30, 60, 90].map((n) => (
              <option value={n} key={n}>
                {n} dias
              </option>
            ))}
          </select>
        </Field>
        <div className="settings-pause">
          <SwitchRow
            label="Leituras automáticas"
            checked={!profile.paused}
            description={
              profile.paused ? "Pausadas" : "Ativas na rotina da Zoe"
            }
            onCheckedChange={(enabled) =>
              setProfile({ ...profile, paused: !enabled })
            }
          />
        </div>
      </fieldset>
      <div className="settings-save" data-dirty={changed || undefined}>
        {changed && (
          <Button
            type="button"
            variant="ghost"
            onClick={(e) => {
              for (const field of e.currentTarget.form.elements)
                field.setCustomValidity?.("");
              setProfile(ops.profile);
              resetHours((n) => n + 1);
            }}
          >
            Desfazer
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={!changed}
        >
          Salvar configuração
        </Button>
      </div>
    </form>
  );
}
