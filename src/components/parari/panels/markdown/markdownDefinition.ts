import type {PanelDefinition} from "../panelDefinitionTypes";
import {MarkdownPanelEditor} from "./MarkdownPanelEditor";
import {MarkdownPanelRenderer} from "./MarkdownPanelRenderer";
import {parseMarkdownPanel,serializeMarkdownPanel,type MarkdownPanelData} from "./markdownSsot";
export const markdownDefinition:PanelDefinition<MarkdownPanelData>={
 tag:"MARKDOWN",label:"Markdown",description:"Markdown文章と表をそのまま貼り付けて表示します。",
 parse:parseMarkdownPanel,serialize:serializeMarkdownPanel,
 Editor:MarkdownPanelEditor,Renderer:MarkdownPanelRenderer,
};
