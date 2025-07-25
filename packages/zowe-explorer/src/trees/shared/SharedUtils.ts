/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

// Generic utility functions related to all node types. See ./src/utils.ts for other utility functions.

import * as vscode from "vscode";
import * as path from "path";
import {
    Gui,
    IZoweTreeNode,
    IZoweDatasetTreeNode,
    IZoweUSSTreeNode,
    IZoweJobTreeNode,
    Types,
    ZosEncoding,
    Sorting,
    imperative,
} from "@zowe/zowe-explorer-api";
import { UssFSProvider } from "../uss/UssFSProvider";
import { USSUtils } from "../uss/USSUtils";
import { Constants } from "../../configuration/Constants";
import { ZoweLocalStorage } from "../../tools/ZoweLocalStorage";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { SharedContext } from "./SharedContext";
import { Definitions } from "../../configuration/Definitions";
import { SettingsConfig } from "../../configuration/SettingsConfig";

export class SharedUtils {
    public static async copyExternalLink(this: void, context: vscode.ExtensionContext, node: IZoweTreeNode): Promise<void> {
        if (node?.resourceUri != null) {
            await vscode.env.clipboard.writeText(`vscode://${context.extension.id}?${node.resourceUri.toString()}`);
        }
    }

    public static filterTreeByString(value: string, treeItems: vscode.QuickPickItem[]): vscode.QuickPickItem[] {
        ZoweLogger.trace("shared.utils.filterTreeByString called.");
        const filteredArray: vscode.QuickPickItem[] = [];
        value = value.toUpperCase().replace(/\*/g, "(.*)");
        const regex = new RegExp(value);
        treeItems.forEach((item) => {
            if (item.label.toUpperCase().match(regex)) {
                filteredArray.push(item);
            }
        });
        return filteredArray;
    }

    /**
     * Gets path to the icon, which is located in resources folder
     * @param iconFileName {string} Name of icon file with extension
     * @returns {object}
     */
    public static getIconPathInResources(iconFileName: string): {
        light: string;
        dark: string;
    } {
        return {
            light: path.join(Constants.ROOTPATH, "resources", "light", iconFileName),
            dark: path.join(Constants.ROOTPATH, "resources", "dark", iconFileName),
        };
    }

    /*************************************************************************************************************
     * Returns array of all subnodes of given node
     *************************************************************************************************************/
    public static concatChildNodes(nodes: Types.IZoweNodeType[]): Types.IZoweNodeType[] {
        ZoweLogger.trace("shared.utils.concatChildNodes called.");
        let allNodes = new Array<Types.IZoweNodeType>();

        for (const node of nodes) {
            allNodes = allNodes.concat(SharedUtils.concatChildNodes(node.children));
            allNodes.push(node);
        }
        return allNodes;
    }

    public static sortTreeItems(favorites: vscode.TreeItem[], specificContext): void {
        favorites.sort((a, b) => {
            if (a.contextValue === specificContext) {
                if (b.contextValue === specificContext) {
                    return a.label.toString().toUpperCase() > b.label.toString().toUpperCase() ? 1 : -1;
                }

                return -1;
            }

            if (b.contextValue === specificContext) {
                return 1;
            }

            return a.label.toString().toUpperCase() > b.label.toString().toUpperCase() ? 1 : -1;
        });
    }

    /*************************************************************************************************************
     * Determine IDE name to display based on app environment
     *************************************************************************************************************/
    public static getAppName(): "VS Code" {
        return "VS Code";
    }

    public static checkIfChildPath(parentPath: string, childPath: string): boolean {
        const relativePath = path.relative(parentPath, childPath);
        return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
    }

    // Type guarding for current IZoweNodeType.
    // Makes it possible to have multiple types in a function signature, but still be able to use type specific code inside the function definition
    public static isZoweDatasetTreeNode(node: Types.IZoweNodeType): node is IZoweDatasetTreeNode {
        return (node as IZoweDatasetTreeNode).pattern !== undefined;
    }

    public static isZoweUSSTreeNode(node: IZoweDatasetTreeNode | IZoweUSSTreeNode | IZoweJobTreeNode): node is IZoweUSSTreeNode {
        return (node as IZoweUSSTreeNode).openUSS !== undefined;
    }

    public static isZoweJobTreeNode(node: IZoweDatasetTreeNode | IZoweUSSTreeNode | IZoweJobTreeNode): node is IZoweJobTreeNode {
        return (node as IZoweJobTreeNode).job !== undefined;
    }

    public static getSelectedNodeList(node: IZoweTreeNode, nodeList: IZoweTreeNode[]): IZoweTreeNode[] {
        let resultNodeList: IZoweTreeNode[] = [];
        if (!nodeList) {
            resultNodeList.push(node);
        } else {
            resultNodeList = nodeList;
        }
        return resultNodeList.filter(Boolean);
    }

    /**
     * Function that validates job prefix
     * @param {string} text - prefix text
     * @returns undefined | string
     */
    public static jobStringValidator(text: string, localizedParam: "owner" | "prefix"): string | null {
        switch (localizedParam) {
            case "owner":
                return text.length > Constants.JOBS_MAX_PREFIX ? vscode.l10n.t("Invalid job owner") : null;
            case "prefix":
            default:
                return text.length > Constants.JOBS_MAX_PREFIX ? vscode.l10n.t("Invalid job prefix") : null;
        }
    }

    public static async getCachedEncoding(node: IZoweTreeNode): Promise<string | undefined> {
        let cachedEncoding: ZosEncoding;
        if (SharedUtils.isZoweUSSTreeNode(node)) {
            cachedEncoding = await node.getEncodingInMap(node.resourceUri.path);
        } else if (SharedUtils.isZoweJobTreeNode(node)) {
            cachedEncoding = await node.getEncodingInMap(node.resourceUri.path);
        } else {
            cachedEncoding = await (node as IZoweDatasetTreeNode).getEncodingInMap(node.resourceUri.path);
        }
        return cachedEncoding?.kind === "other" ? cachedEncoding.codepage : cachedEncoding?.kind;
    }

    public static parseFavorites(lines: string[]): Definitions.FavoriteData[] {
        const invalidFavoriteWarning = (line: string): void =>
            ZoweLogger.warn(
                vscode.l10n.t({ message: "Failed to parse a saved favorite. Attempted to parse: {0}", args: [line], comment: ["Plaintext line"] })
            );

        return lines
            .map((line) => {
                // [profile]: label{context}
                const closingSquareBracket = line.indexOf("]");

                // Filter out lines with a missing opening/closing square bracket as they are invalid
                if (!line.startsWith("[") || closingSquareBracket === -1) {
                    invalidFavoriteWarning(line);
                    return null;
                }

                const profileName = line.substring(1, closingSquareBracket);

                // label{context}
                const remainderOfLine = line.substring(closingSquareBracket + 2).trim();

                // Filter out lines that do not contain a label and context value
                if (remainderOfLine.length === 0) {
                    invalidFavoriteWarning(line);
                    return null;
                }

                const openingCurlyBrace = remainderOfLine.indexOf("{");
                return {
                    profileName,
                    label: remainderOfLine.substring(0, openingCurlyBrace).trim(),
                    contextValue: openingCurlyBrace > 0 ? remainderOfLine.substring(openingCurlyBrace + 1, remainderOfLine.indexOf("}")) : undefined,
                };
            })
            .filter(Boolean);
    }

    public static async promptForEncoding(
        node: IZoweDatasetTreeNode | IZoweUSSTreeNode | IZoweJobTreeNode,
        taggedEncoding?: string
    ): Promise<ZosEncoding | undefined> {
        const ebcdicItem: vscode.QuickPickItem = {
            label: vscode.l10n.t("EBCDIC"),
            description: vscode.l10n.t("z/OS default codepage"),
        };
        const binaryItem: vscode.QuickPickItem = {
            label: vscode.l10n.t("Binary"),
            description: vscode.l10n.t("Raw data representation"),
        };
        const otherItem: vscode.QuickPickItem = {
            label: vscode.l10n.t("Other"),
            description: vscode.l10n.t("Specify another codepage"),
        };
        const items: vscode.QuickPickItem[] = [ebcdicItem, binaryItem, otherItem, Constants.SEPARATORS.RECENT];
        const profile = node.getProfile();
        if (profile.profile?.encoding != null) {
            items.splice(0, 0, {
                label: String(profile.profile?.encoding),
                description: vscode.l10n.t({
                    message: "From profile {0}",
                    args: [profile.name],
                    comment: ["Profile name"],
                }),
            });
        }
        if (taggedEncoding != null) {
            items.splice(0, 0, {
                label: taggedEncoding,
                description: vscode.l10n.t("USS file tag"),
            });
        }

        let zosEncoding = await node.getEncoding();
        if (zosEncoding === undefined && SharedUtils.isZoweUSSTreeNode(node)) {
            zosEncoding = await UssFSProvider.instance.fetchEncodingForUri(node.resourceUri);
        }
        let currentEncoding = zosEncoding ? USSUtils.zosEncodingToString(zosEncoding) : await SharedUtils.getCachedEncoding(node);
        if (zosEncoding?.kind === "binary" || currentEncoding === "binary") {
            currentEncoding = binaryItem.label;
        } else if (zosEncoding?.kind === "text" || currentEncoding === "text") {
            currentEncoding = ebcdicItem.label;
        } else if (zosEncoding == null && currentEncoding == null) {
            currentEncoding = profile.profile?.encoding ?? ebcdicItem.label;
        }
        const encodingHistory = ZoweLocalStorage.getValue<string[]>(Definitions.LocalStorageKey.ENCODING_HISTORY) ?? [];
        if (encodingHistory.length > 0) {
            for (const encoding of encodingHistory) {
                items.push({ label: encoding });
            }
        } else {
            // Pre-populate recent list with some common encodings
            items.push({ label: "IBM-1047" }, { label: "ISO8859-1" });
        }

        let response = (
            await Gui.showQuickPick(items, {
                title: vscode.l10n.t({
                    message: "Choose encoding for {0}",
                    args: [node.label as string],
                    comment: ["Node label"],
                }),
                placeHolder:
                    currentEncoding &&
                    vscode.l10n.t({
                        message: "Current encoding is {0}",
                        args: [currentEncoding],
                        comment: ["Encoding name"],
                    }),
            })
        )?.label;
        let encoding: ZosEncoding;
        switch (response) {
            case ebcdicItem.label:
                encoding = { kind: "text" };
                break;
            case binaryItem.label:
                encoding = { kind: "binary" };
                break;
            case otherItem.label:
                response = await Gui.showInputBox({
                    title: vscode.l10n.t({
                        message: "Choose encoding for {0}",
                        args: [node.label as string],
                        comment: ["Node label"],
                    }),
                    placeHolder: vscode.l10n.t("Enter a codepage (e.g., 1047, IBM-1047)"),
                });
                if (response) {
                    encoding = { kind: "other", codepage: response };
                    encodingHistory.push(encoding.codepage);
                    ZoweLocalStorage.setValue(Definitions.LocalStorageKey.ENCODING_HISTORY, encodingHistory.slice(0, Constants.MAX_FILE_HISTORY));
                } else {
                    Gui.infoMessage(vscode.l10n.t("Operation cancelled"));
                }
                break;
            default:
                if (response != null) {
                    encoding = response === "binary" ? { kind: "binary" } : { kind: "other", codepage: response };
                }
                break;
        }
        return encoding;
    }

    public static getSessionLabel(node: IZoweTreeNode): string {
        return (SharedContext.isSession(node) ? node : node.getSessionNode()).label as string;
    }

    /**
     * Adds one or more Data Sets/USS nodes to a workspace.
     * @param node Single node selection
     * @param nodeList List of selected nodes
     */
    public static addToWorkspace(
        this: void,
        node: IZoweUSSTreeNode | IZoweDatasetTreeNode,
        nodeList: IZoweUSSTreeNode[] | IZoweDatasetTreeNode[]
    ): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList);
        const urisToAdd: {
            name: string;
            uri: vscode.Uri;
        }[] = [];
        for (const item of selectedNodes) {
            let resourceUri = item.resourceUri;
            const isSession = SharedContext.isSession(item);
            if (isSession) {
                if (item.fullPath?.length > 0) {
                    resourceUri = item.resourceUri.with({ path: path.posix.join(item.resourceUri.path, item.fullPath) });
                } else {
                    Gui.infoMessage(
                        vscode.l10n.t({
                            message: "A search must be set for {0} before it can be added to a workspace.",
                            args: [item.label as string],
                            comment: "Name of USS session",
                        })
                    );
                    continue;
                }
            }
            if (workspaceFolders?.some((folder) => folder.uri === resourceUri)) {
                continue;
            }

            urisToAdd.push({
                name: `[${item.getProfileName()}] ${SharedContext.isDatasetNode(item) ? (item.label as string) : item.fullPath}`,
                uri: resourceUri,
            });
        }

        vscode.workspace.updateWorkspaceFolders(workspaceFolders?.length ?? 0, null, ...urisToAdd);
    }

    /**
     * Debounces an event handler to prevent duplicate triggers.
     * @param callback Event handler callback
     * @param delay Number of milliseconds to delay
     */
    public static debounce<T extends (...args: any[]) => void>(callback: T, delay: number): (...args: Parameters<T>) => void {
        let timeoutId: ReturnType<typeof setTimeout>;
        return (...args: Parameters<T>): void => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => callback(...args), delay);
        };
    }

    /**
     * Debounces an async event callback to prevent duplicate triggers.
     * @param callback Async event callback
     * @param delay Number of milliseconds to delay
     */
    public static debounceAsync<T extends (...args: any[]) => Promise<any>>(
        callback: T,
        delay: number
    ): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
        let timeoutId: ReturnType<typeof setTimeout>;

        return (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Returns a promise that is fulfilled after the debounced callback finishes
            return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
                timeoutId = setTimeout(() => {
                    callback(...args).then(resolve, reject);
                }, delay);
            });
        };
    }

    public static updateSortOptionsWithDefault<T>(sortMethod: T, sortOptions: string[]): void {
        ZoweLogger.trace("shared.utils.updateSortOptionsWithDefault called.");
        for (let i = 0; i < sortOptions.length; i++) {
            sortOptions[i] = sortOptions[i].replace(` ${vscode.l10n.t("(default)")}`, "");
            if (i === Number(sortMethod)) {
                sortOptions[i] = `${sortOptions[i]} ${vscode.l10n.t("(default)")}`;
            }
        }
    }

    /**
     * Gets the sort options from the settings with the default sort option marked
     * @param sortOptions The list of sort options
     * @param settingsKey The default sort method key
     * @param sortMethod The sort method
     * @returns The list of sort options with the default sort option marked
     */
    public static getDefaultSortOptions<T extends object>(sortOptions: string[], settingsKey: string, sortMethod: T): Sorting.NodeSort {
        ZoweLogger.trace("shared.utils.getDefaultSortOptions called.");
        const defaultMethod = sortMethod[Object.keys(sortMethod)[0]];
        const defaultDirection = Sorting.SortDirection.Ascending;

        const sortSetting = SettingsConfig.getDirectValue<Sorting.NodeSort>(settingsKey);
        if (sortSetting == null || !sortSetting.method || !sortSetting.direction) {
            SharedUtils.updateSortOptionsWithDefault(defaultMethod, sortOptions);
            return {
                method: defaultMethod,
                direction: defaultDirection,
            };
        }

        if (typeof sortSetting.method === "string") {
            const methodKey = sortSetting.method as keyof typeof sortMethod;
            if (methodKey in sortMethod) {
                sortSetting.method = sortMethod[methodKey] as Sorting.JobSortOpts | Sorting.DatasetSortOpts;
            } else {
                sortSetting.method = defaultMethod;
            }
            SharedUtils.updateSortOptionsWithDefault(sortSetting.method, sortOptions);
        }

        if (typeof sortSetting.direction === "string") {
            const directionKey = sortSetting.direction as keyof typeof Sorting.SortDirection;
            if (directionKey in Sorting.SortDirection) {
                sortSetting.direction = Sorting.SortDirection[directionKey];
            } else {
                sortSetting.direction = defaultDirection;
            }
        }

        return {
            method: sortSetting?.method ?? defaultMethod,
            direction: sortSetting?.direction ?? defaultDirection,
        };
    }

    public static async handleDragAndDropOverwrite(
        target: IZoweDatasetTreeNode | IZoweUSSTreeNode | undefined,
        draggedNodes: Record<string, IZoweDatasetTreeNode | IZoweUSSTreeNode>
    ): Promise<boolean> {
        const movedIntoChild = Object.values(draggedNodes).some((n) => target.resourceUri.path.startsWith(n.resourceUri.path));
        if (movedIntoChild) {
            return false;
        }

        // determine if any overwrites may occur
        const willOverwrite = Object.values(draggedNodes).some((n) => target.children?.find((tc) => tc.label === n.label) != null);
        if (willOverwrite) {
            const userOpts = [vscode.l10n.t("Confirm")];
            const resp = await Gui.warningMessage(
                vscode.l10n.t("One or more items may be overwritten from this drop operation. Confirm or cancel?"),
                {
                    items: userOpts,
                    vsCodeOpts: {
                        modal: true,
                    },
                }
            );
            if (resp == null || resp !== userOpts[0]) {
                return false;
            } else {
                return true;
            }
        }
        return true;
    }

    public static async handleProfileChange(treeProviders: Definitions.IZoweProviders, profile: imperative.IProfileLoaded): Promise<void> {
        for (const provider of Object.values(treeProviders)) {
            try {
                const node = (await provider.getChildren()).find((n) => n.label === profile?.name);
                node?.setProfileToChoice?.(profile);
            } catch (err) {
                if (err instanceof Error) {
                    ZoweLogger.error(err.message);
                }
                return;
            }
        }
    }
}
