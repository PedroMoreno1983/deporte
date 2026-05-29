import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import { ArrowRight } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
  parameters: { layout: "centered" },
  argTypes: {
    variant: { control: "radio", options: ["primary", "secondary", "danger", "ghost", "outline"] },
    size:    { control: "radio", options: ["sm", "md", "lg"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary:   Story = { args: { children: "Guardar cambios", variant: "primary" } };
export const Secondary: Story = { args: { children: "Cancelar",         variant: "secondary" } };
export const Danger:    Story = { args: { children: "Eliminar",         variant: "danger" } };
export const Outline:   Story = { args: { children: "Suscribir",        variant: "outline" } };
export const Loading:   Story = { args: { children: "Procesando",       loading: true } };
export const WithIcon:  Story = {
  args: {
    children: (
      <>
        Continuar
        <ArrowRight className="w-4 h-4" />
      </>
    ),
  },
};
