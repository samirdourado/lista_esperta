"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/api/errors";
import { useAddMember, useRemoveMember, useStoreMembers } from "@/lib/merchant/queries";
import { useSession } from "@/lib/session";
import { useIsOwner, useStoreId } from "./StoreShell";

export function TeamView() {
  const storeId = useStoreId();
  const owner = useIsOwner(storeId);
  const { data: me } = useSession();
  const members = useStoreMembers(storeId);
  const add = useAddMember(storeId);
  const remove = useRemoveMember(storeId);
  const [email, setEmail] = useState("");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <p className="text-ink-soft">
        A equipe pode editar produtos, preços e ofertas. Só quem é dono(a) adiciona ou remove pessoas e confere o CNPJ.
      </p>
      {members.isPending && <Skeleton className="h-24 w-full" />}
      {members.isError && <Notice tone="danger" title={errorMessage(members.error)} />}
      <ul className="divide-y divide-line rounded-md border border-line bg-surface">
        {(members.data ?? []).map((member) => (
          <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="font-medium">{member.displayName}</span>
              {member.userId === me?.id && <span className="text-ink-soft"> (você)</span>}
              <span className="ml-2 text-[0.9rem] text-ink-soft">
                {member.memberRole === "OWNER" ? "Dono(a)" : "Equipe"}
              </span>
            </span>
            {owner && member.userId !== me?.id && (
              <Button
                variant="ghost"
                loading={remove.isPending && remove.variables === member.userId}
                onClick={() => {
                  if (window.confirm(`Remover ${member.displayName} da equipe?`)) remove.mutate(member.userId);
                }}
              >
                Remover
              </Button>
            )}
          </li>
        ))}
      </ul>
      {remove.isError && (
        <Notice tone="danger" title={errorMessage(remove.error, { 409: "A loja precisa de pelo menos um dono(a)." })} />
      )}

      {owner && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate(email.trim(), { onSuccess: () => setEmail("") });
          }}
        >
          <TextField
            label="Adicionar pessoa pelo e-mail"
            hint="A pessoa precisa ter uma conta de lojista no Lista Esperta."
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {add.isError && (
            <Notice
              tone="danger"
              title={errorMessage(add.error, {
                404: "Não há conta de lojista com esse e-mail.",
                409: "Essa pessoa já está na equipe.",
              })}
            />
          )}
          {add.isSuccess && <Notice tone="success" title="Pessoa adicionada à equipe." />}
          <Button type="submit" loading={add.isPending} disabled={!email.trim()} className="self-start">
            Adicionar à equipe
          </Button>
        </form>
      )}
    </div>
  );
}
