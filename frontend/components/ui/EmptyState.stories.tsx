import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "Feedback/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div style={{ width: 400 }}><Story /></div>],
  argTypes: {
    illustration: {
      control: "select",
      options: ["players", "injuries-ok", "matches", "training", "notifications", "wellness", "data", "predictions"],
    },
    size: { control: "radio", options: ["default", "compact"] },
  },
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const NoPlayers:    Story = { args: { illustration: "players",      title: "Sin jugadores",     description: "Agrega tu primer jugador desde el plantel." } };
export const InjuriesOk:   Story = { args: { illustration: "injuries-ok",  title: "Sin lesiones",      description: "El plantel está en óptimas condiciones." } };
export const NoMatches:    Story = { args: { illustration: "matches",      title: "Sin partidos",      description: "Cuando registres un partido aparecerá acá." } };
export const NoData:       Story = { args: { illustration: "data",         title: "Sin datos",         description: "Aún no hay estadísticas suficientes." } };
export const Predictions:  Story = { args: { illustration: "predictions",  title: "Modelo no calculado", description: "Genera predicciones desde la página de Analytics." } };
