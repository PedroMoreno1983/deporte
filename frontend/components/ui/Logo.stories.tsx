import type { Meta, StoryObj } from "@storybook/react";
import { Logo } from "./Logo";

const meta: Meta<typeof Logo> = {
  title: "Brand/Logo",
  component: Logo,
  parameters: { layout: "centered" },
  argTypes: {
    variant: { control: "radio", options: ["mark", "wordmark", "monogram"] },
    size:    { control: { type: "range", min: 16, max: 96, step: 4 } },
    flat:    { control: "boolean" },
  },
};
export default meta;

type Story = StoryObj<typeof Logo>;

export const Mark:     Story = { args: { variant: "mark",     size: 64 } };
export const Wordmark: Story = { args: { variant: "wordmark", size: 48 } };
export const Monogram: Story = { args: { variant: "monogram", size: 64 } };
export const Flat:     Story = { args: { variant: "mark", size: 48, flat: true } };
