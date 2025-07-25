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

import * as vscode from "vscode";
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import { Gui, imperative, Validation, ProfilesCache, ZoweExplorerApiType, Sorting } from "@zowe/zowe-explorer-api";
import { DatasetFSProvider } from "../../../../src/trees/dataset/DatasetFSProvider";
import { bindMvsApi, createMvsApi } from "../../../__mocks__/mockCreators/api";
import {
    createSessCfgFromArgs,
    createInstanceOfProfile,
    createIProfile,
    createISession,
    createISessionWithoutCredentials,
    createTreeView,
    createQuickPickContent,
    createWorkspaceConfiguration,
    createGetConfigMock,
} from "../../../__mocks__/mockCreators/shared";
import {
    createDatasetAttributes,
    createDatasetSessionNode,
    createDatasetFavoritesNode,
    createDatasetTree,
    createDSMemberAttributes,
} from "../../../__mocks__/mockCreators/datasets";
import { Constants } from "../../../../src/configuration/Constants";
import { Profiles } from "../../../../src/configuration/Profiles";
import { FilterDescriptor } from "../../../../src/management/FilterManagement";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { ZoweDatasetNode } from "../../../../src/trees/dataset/ZoweDatasetNode";
import { SharedUtils } from "../../../../src/trees/shared/SharedUtils";
import { mocked } from "../../../__mocks__/mockUtils";
import { DatasetActions } from "../../../../src/trees/dataset/DatasetActions";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import { SettingsConfig } from "../../../../src/configuration/SettingsConfig";
import { TreeViewUtils } from "../../../../src/utils/TreeViewUtils";
import { DatasetUtils } from "../../../../src/trees/dataset/DatasetUtils";
import { ProfileManagement } from "../../../../src/management/ProfileManagement";
import { DataSetAttributesProvider } from "../../../../../zowe-explorer-api/lib/dataset/DatasetAttributesProvider";

// Missing the definition of path module, because I need the original logic for tests
jest.mock("fs");
jest.mock("vscode");
jest.mock("../../../../src/tools/ZoweLogger");

let mockClipboardData = null;
let clipboard;

function createGlobalMocks() {
    clipboard = {
        writeText: jest.fn().mockImplementation((value) => (mockClipboardData = value)),
        readText: jest.fn().mockImplementation(() => mockClipboardData),
    };

    const newMocks = {
        imperativeProfile: createIProfile(),
        profileInstance: null,
        session: createISession(),
        treeView: createTreeView(),
        datasetSessionNode: null,
        datasetSessionFavNode: null,
        testFavoritesNode: createDatasetFavoritesNode(),
        testDatasetTree: null,
        getContentsSpy: null,
        fspDelete: jest.spyOn(vscode.workspace.fs, "delete").mockImplementation(),
        statusBarMsgSpy: null,
        mvsApi: null,
        mockShowWarningMessage: jest.fn(),
        showInputBox: jest.fn(),
        getConfiguration: jest
            .spyOn(vscode.workspace, "getConfiguration")
            .mockReturnValue({ has: jest.fn(), get: jest.fn().mockImplementation((_key, def) => def), inspect: jest.fn(), update: jest.fn() }),
        fetchAllMock: jest.fn().mockReturnValue([]),
    };
    newMocks.fspDelete.mockClear();

    newMocks.profileInstance = createInstanceOfProfile(newMocks.imperativeProfile);
    newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
    newMocks.datasetSessionFavNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
    newMocks.testFavoritesNode.children.push(newMocks.datasetSessionFavNode);
    jest.spyOn(Gui, "createTreeView").mockReturnValue({ onDidCollapseElement: jest.fn() } as any);
    newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView, newMocks.testFavoritesNode);
    newMocks.mvsApi = createMvsApi(newMocks.imperativeProfile);
    newMocks.getContentsSpy = jest.spyOn(newMocks.mvsApi, "getContents");
    bindMvsApi(newMocks.mvsApi);

    Object.defineProperty(vscode.window, "withProgress", { value: jest.fn(), configurable: true });
    Object.defineProperty(SettingsConfig, "getDirectValue", {
        value: createGetConfigMock({
            "zowe.ds.default.sort": Sorting.DatasetSortOpts.Name,
        }),
    });

    jest.spyOn(DataSetAttributesProvider, "getInstance").mockReturnValue({
        fetchAll: newMocks.fetchAllMock,
    } as Partial<DataSetAttributesProvider> as any);

    Object.defineProperty(zosfiles, "Upload", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles.Upload, "bufferToDataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles.Upload, "pathToDataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "errorMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "showMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "setStatusBarMessage", { value: jest.fn().mockReturnValue({ dispose: jest.fn() }), configurable: true });
    newMocks.statusBarMsgSpy = jest.spyOn(Gui, "setStatusBarMessage");

    Object.defineProperty(Gui, "warningMessage", {
        value: newMocks.mockShowWarningMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showInputBox", { value: newMocks.showInputBox, configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showTextDocument", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "applyEdit", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles, "Download", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles.Download, "dataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles, "Delete", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles.Delete, "dataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles, "Create", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles.Create, "dataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles.Create, "dataSetLike", { value: jest.fn(), configurable: true });
    Object.defineProperty(SharedUtils, "concatChildNodes", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles, "List", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles.List, "dataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "createWebviewPanel", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.env, "clipboard", { value: clipboard, configurable: true });
    mocked(Profiles.getInstance).mockReturnValue(newMocks.profileInstance);

    return newMocks;
}

const createBlockMocksShared = () => {
    const session = createISession();
    const imperativeProfile = createIProfile();
    const zosmfSession = createSessCfgFromArgs(imperativeProfile);
    const treeView = createTreeView();
    const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
    const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
    const mvsApi = createMvsApi(imperativeProfile);
    const fetchDsAtUri = jest.spyOn(DatasetFSProvider.instance, "fetchDatasetAtUri").mockImplementation();
    bindMvsApi(mvsApi);
    Object.defineProperty(ProfilesCache, "getProfileSessionWithVscProxy", { value: jest.fn().mockReturnValue(zosmfSession), configurable: true });

    return {
        session,
        zosmfSession,
        treeView,
        imperativeProfile,
        datasetSessionNode,
        mvsApi,
        testDatasetTree,
        fetchDsAtUri,
    };
};

describe("Dataset Actions Unit Tests - Function createMember", () => {
    afterAll(() => jest.restoreAllMocks());
    const globalMocks = createGlobalMocks();

    it("Checking of common dataset member creation", async () => {
        const blockMocks = createBlockMocksShared();
        const parent = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            session: blockMocks.session,
        });

        const mySpy = mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("testMember");
            return Promise.resolve("testMember");
        });

        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        globalMocks.getContentsSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123",
            },
        });
        jest.spyOn(blockMocks.mvsApi, "allMembers").mockImplementation(jest.fn());

        await DatasetActions.createMember(parent, blockMocks.testDatasetTree);

        const newNode = parent.children.find((node) => node.label === "TESTMEMBER");
        expect(newNode).toBeDefined();
        expect(newNode?.contextValue).toBe(Constants.DS_MEMBER_CONTEXT);
        expect(newNode?.command.command).toBe("vscode.open");
        expect(mySpy).toHaveBeenCalledWith({
            placeHolder: "Name of member",
            validateInput: expect.any(Function),
        });
        expect(mocked(zosfiles.Upload.bufferToDataSet)).toHaveBeenCalledWith(
            blockMocks.zosmfSession,
            Buffer.from(""),
            (parent.label as string) + "(TESTMEMBER)",
            {
                responseTimeout: blockMocks.imperativeProfile.profile?.responseTimeout,
            }
        );
    });
    it("Checking failed attempt to create dataset member", async () => {
        const blockMocks = createBlockMocksShared();
        createGlobalMocks();
        const parent = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            session: blockMocks.session,
        });

        mocked(vscode.window.showInputBox).mockResolvedValue("testMember");
        mocked(zosfiles.Upload.bufferToDataSet).mockRejectedValueOnce(Error("Error when uploading to data set"));

        try {
            await DatasetActions.createMember(parent, blockMocks.testDatasetTree);
        } catch (err) {
            // Prevent exception from failing test
        }

        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith("Error when uploading to data set", { items: ["Show log", "Troubleshoot"] });
        mocked(zosfiles.Upload.bufferToDataSet).mockReset();
    });
    it("Checking of attempt to create member without name", async () => {
        const blockMocks = createBlockMocksShared();
        const parent = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            session: blockMocks.session,
        });

        mocked(vscode.window.showInputBox).mockResolvedValue("");
        await DatasetActions.createMember(parent, blockMocks.testDatasetTree);

        expect(mocked(zosfiles.Upload.bufferToDataSet)).not.toHaveBeenCalled();
    });
    it("Checking of member creation for favorite dataset", async () => {
        const blockMocks = createBlockMocksShared();
        const parent = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            session: blockMocks.session,
        });
        const nonFavoriteLabel = parent.label?.toString();
        parent.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;

        const mySpy = mocked(vscode.window.showInputBox).mockResolvedValue("testMember");
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        globalMocks.getContentsSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123",
            },
        });

        await DatasetActions.createMember(parent, blockMocks.testDatasetTree);

        expect(parent.children.find((node) => node.label === "TESTMEMBER")).toBeDefined();
        expect(mySpy).toHaveBeenCalledWith({ placeHolder: "Name of member", validateInput: expect.any(Function) });
        expect(mocked(zosfiles.Upload.bufferToDataSet)).toHaveBeenCalledWith(
            blockMocks.zosmfSession,
            Buffer.from(""),
            nonFavoriteLabel + "(TESTMEMBER)",
            {
                responseTimeout: blockMocks.imperativeProfile.profile?.responseTimeout,
            }
        );
    });

    it("should not replace existing member when user cancels the replacement prompt", async () => {
        const blockMocks = createBlockMocksShared();
        const parent = new ZoweDatasetNode({
            label: "PDS.EXAMPLE",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        const pdsMember = new ZoweDatasetNode({
            label: "EX1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: parent,
            contextOverride: Constants.DS_MEMBER_CONTEXT,
        });
        parent.children = [pdsMember];

        blockMocks.testDatasetTree.getChildren = jest.fn().mockResolvedValueOnce([parent]);

        jest.spyOn(DatasetActions, "determineReplacement").mockResolvedValueOnce("cancel" as any);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("EX1");

        jest.spyOn(DatasetFSProvider.instance, "fetchDatasetAtUri").mockResolvedValueOnce(true as any);

        await DatasetActions.createMember(parent, blockMocks.testDatasetTree);

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith("vscode.open", { path: "/sestest/PDS.EXAMPLE/EX1", scheme: "zowe-ds" });
        expect(blockMocks.testDatasetTree.refresh).toHaveBeenCalled();
    });
});

describe("Dataset Actions Unit Tests - Function refreshPS", () => {
    afterAll(() => jest.restoreAllMocks());

    it("Checking common PS dataset refresh", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.AFILE7",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });

        await DatasetActions.refreshPS(node);
        expect(blockMocks.fetchDsAtUri).toHaveBeenCalledWith(node.resourceUri, { editor: undefined });
    });
    it("Checking duplicate PS dataset refresh attempt", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.AFILE7",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: false } as any);
        mocked(zosfiles.Download.dataSet).mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123",
            },
        });

        await DatasetActions.refreshPS(node);

        expect(mocked(vscode.commands.executeCommand)).not.toHaveBeenCalled();
    });
    it("Checking failed attempt to refresh PS dataset (not found exception)", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.AFILE7",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });

        blockMocks.fetchDsAtUri.mockRejectedValueOnce(Error("not found"));

        await DatasetActions.refreshPS(node);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith("Unable to find file " + (node.label as string));
    });
    it("Checking failed attempt to refresh PDS Member", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const parent = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        const child = new ZoweDatasetNode({ label: "child", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent });

        blockMocks.fetchDsAtUri.mockRejectedValueOnce(Error("not found"));

        await DatasetActions.refreshPS(child);
        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith(`Unable to find file ${parent.label?.toString()}(${child.label?.toString()})`);
    });
    it("Checking favorite empty PDS refresh", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.AFILE7",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;

        await DatasetActions.refreshPS(node);
        expect(blockMocks.fetchDsAtUri).toHaveBeenCalledWith(node.resourceUri, { editor: undefined });
    });
    it("Checking favorite PDS Member refresh", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const parent = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        const child = new ZoweDatasetNode({ label: "child", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent });
        parent.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;

        await DatasetActions.refreshPS(child);
        expect(blockMocks.fetchDsAtUri).toHaveBeenCalledWith(child.resourceUri, { editor: undefined });
    });
    it("Checking favorite PS refresh", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const parent = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        const child = new ZoweDatasetNode({ label: "child", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent });
        child.contextValue = Constants.DS_FAV_CONTEXT;

        await DatasetActions.refreshPS(child);
        expect(blockMocks.fetchDsAtUri).toHaveBeenCalledWith(child.resourceUri, { editor: undefined });
    });
});

describe("Dataset Actions Unit Tests - Function deleteDatasetPrompt", () => {
    function createBlockMocks(globalMocks) {
        const testDatasetTree = createDatasetTree(globalMocks.datasetSessionNode, globalMocks.treeView, globalMocks.testFavoritesNode);
        const testDatasetNode = new ZoweDatasetNode({
            label: "HLQ.TEST.DS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: globalMocks.datasetSessionNode,
            session: globalMocks.session,
            profile: globalMocks.imperativeProfile,
            contextOverride: Constants.DS_PDS_CONTEXT,
        });
        const testVsamNode = new ZoweDatasetNode({
            label: "HLQ.TEST.VSAM",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: globalMocks.datasetSessionNode,
            session: globalMocks.session,
            profile: globalMocks.imperativeProfile,
            contextOverride: Constants.VSAM_CONTEXT,
        });
        const testMigrNode = new ZoweDatasetNode({
            label: "HLQ.TEST.MIGR",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: globalMocks.datasetSessionNode,
            session: globalMocks.session,
            profile: globalMocks.imperativeProfile,
            contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
        });
        const testMemberNode = new ZoweDatasetNode({
            label: "MEMB",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testDatasetNode,
            session: globalMocks.session,
            profile: globalMocks.imperativeProfile,
            contextOverride: Constants.DS_MEMBER_CONTEXT,
        });
        const testFavoritedNode = new ZoweDatasetNode({
            label: "HLQ.TEST.FAV",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: globalMocks.datasetSessionFavNode,
            session: globalMocks.session,
            profile: globalMocks.imperativeProfile,
            contextOverride: Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX,
        });
        const testFavMemberNode = new ZoweDatasetNode({
            label: "MEMB",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testFavoritedNode,
            session: globalMocks.session,
            profile: globalMocks.imperativeProfile,
            contextOverride: Constants.DS_MEMBER_CONTEXT,
        });

        testDatasetNode.children.push(testMemberNode);
        testFavoritedNode.children.push(testFavMemberNode);
        globalMocks.datasetSessionNode.children.push(testDatasetNode);
        globalMocks.datasetSessionNode.children.push(testVsamNode);
        globalMocks.datasetSessionNode.children.push(testMigrNode);
        globalMocks.datasetSessionFavNode.children.push(testFavoritedNode);

        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            const progress = {
                report: jest.fn(),
            };
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            return callback(progress, token);
        });

        return {
            testDatasetTree,
            testDatasetNode,
            testVsamNode,
            testMigrNode,
            testMemberNode,
            testFavMemberNode,
            testFavoritedNode,
            fixMultiSelectMock: jest.spyOn(TreeViewUtils, "fixVsCodeMultiSelect"),
        };
    }

    // afterAll(() => jest.restoreAllMocks());

    it("Should delete one dataset", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testDatasetNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await DatasetActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith(
            `The following 1 item(s) were deleted:\n ${blockMocks.testDatasetNode.getLabel().toString()}`
        );
        expect(blockMocks.fixMultiSelectMock).toHaveBeenCalledWith(blockMocks.testDatasetTree, blockMocks.testDatasetNode.getParent());
    });

    it("Should delete one member", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testMemberNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        jest.spyOn(vscode.workspace.fs, "delete").mockImplementation();
        await DatasetActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith(
            `The following 1 item(s) were deleted:\n ` +
                `${blockMocks.testMemberNode.getParent().getLabel().toString()}(${blockMocks.testMemberNode.getLabel().toString()})`
        );
        expect(blockMocks.fixMultiSelectMock).toHaveBeenCalledWith(blockMocks.testDatasetTree, blockMocks.testMemberNode.getParent());
    });

    it("Should delete one VSAM", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testVsamNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await DatasetActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith(
            `The following 1 item(s) were deleted:\n ${blockMocks.testVsamNode.getLabel().toString()}`
        );
    });

    it("Should delete one migrated dataset", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testMigrNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await DatasetActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith(
            `The following 1 item(s) were deleted:\n ${blockMocks.testMigrNode.getLabel().toString()}`
        );
    });

    it("Should delete two datasets", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testDatasetNode, blockMocks.testVsamNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await DatasetActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith(
            `The following 2 item(s) were deleted:\n ` +
                `${blockMocks.testDatasetNode.getLabel().toString()}\n ${blockMocks.testVsamNode.getLabel().toString()}`
        );
    });

    it("Should delete one dataset and one member but only the parent will be listed in output", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testMemberNode, blockMocks.testDatasetNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await DatasetActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith(
            `The following 1 item(s) were deleted:\n ${blockMocks.testDatasetNode.getLabel().toString()}`
        );
    });

    it("Should delete a favorited data set", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testFavoritedNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Cancel");

        await DatasetActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.warningMessage)).toHaveBeenCalledWith(
            `Are you sure you want to delete the following 1 item(s)?\nThis will permanently remove these data sets and/or members from your ` +
                `system.\n\n ${blockMocks.testFavoritedNode.getLabel().toString()}`,
            { items: ["Delete"], vsCodeOpts: { modal: true } }
        );
    });

    it("Should delete a favorited member", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testFavMemberNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Cancel");

        await DatasetActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.warningMessage)).toHaveBeenCalledWith(
            `Are you sure you want to delete the following 1 item(s)?\nThis will permanently remove these data sets and/or members from your ` +
                `system.\n\n ${blockMocks.testFavoritedNode.getLabel().toString()}(${blockMocks.testFavMemberNode.getLabel().toString()})`,
            { items: ["Delete"], vsCodeOpts: { modal: true } }
        );
    });

    it("Should not consider a session for deletion", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [globalMocks.datasetSessionNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Cancel");

        await DatasetActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith("No data sets selected for deletion, cancelling...");
    });

    it("Should account for favorited data sets during deletion", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testFavoritedNode, blockMocks.testDatasetNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await DatasetActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith(
            `The following 2 item(s) were deleted:\n ` +
                `${blockMocks.testDatasetNode.getLabel().toString()}\n ${blockMocks.testFavoritedNode.getLabel().toString()}`
        );
    });

    it("Should cancel deletion if user selects Cancel", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Cancel");

        await DatasetActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(vscode.window.withProgress).mock.calls.length).toBe(0);
    });

    it("test when selected node is sent", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testMemberNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await DatasetActions.deleteDatasetPrompt(blockMocks.testDatasetTree, blockMocks.testMemberNode);
        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith(
            `The following 1 item(s) were deleted:\n ` +
                `${blockMocks.testMemberNode.getParent().getLabel().toString()}(${blockMocks.testMemberNode.getLabel().toString()})`
        );
    });
});

describe("Dataset Actions Unit Tests - Function deleteDataset", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const mvsApi = createMvsApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindMvsApi(mvsApi);

        return {
            session,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            profileInstance,
            mvsApi,
            testDatasetTree,
            mockCheckCurrentProfile,
        };
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking common PS dataset deletion", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            profile: blockMocks.imperativeProfile,
        });

        await DatasetActions.deleteDataset(node, blockMocks.testDatasetTree);
        expect(globalMocks.fspDelete).toHaveBeenCalledWith(node.resourceUri, { recursive: false });
    });
    it("Checking common PS dataset deletion with Unverified profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: Validation.ValidationType.UNVERIFIED,
                };
            }),
        });
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            profile: blockMocks.imperativeProfile,
        });

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(vscode.workspace.fs, "delete").mockImplementation();
        await DatasetActions.deleteDataset(node, blockMocks.testDatasetTree);
        expect(deleteSpy).toHaveBeenCalledWith(node.resourceUri, { recursive: false });
    });
    it("Checking common PS dataset deletion with not existing local file", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            profile: blockMocks.imperativeProfile,
        });

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(vscode.workspace.fs, "delete").mockImplementation();
        await DatasetActions.deleteDataset(node, blockMocks.testDatasetTree);
        expect(deleteSpy).toHaveBeenCalledWith(node.resourceUri, { recursive: false });
    });
    it("Checking common PS dataset failed deletion attempt due to absence on remote", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            profile: blockMocks.imperativeProfile,
        });

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        jest.spyOn(vscode.workspace.fs, "delete").mockRejectedValueOnce(Error("not found"));
        await expect(DatasetActions.deleteDataset(node, blockMocks.testDatasetTree)).rejects.toThrow("not found");
        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith("Unable to find file " + node.label?.toString());
    });
    it("Checking common PS dataset failed deletion attempt", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            profile: blockMocks.imperativeProfile,
        });

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        jest.spyOn(vscode.workspace.fs, "delete").mockRejectedValueOnce(Error("Deletion error"));
        await expect(DatasetActions.deleteDataset(node, blockMocks.testDatasetTree)).rejects.toThrow("");
        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith("Deletion error", { items: ["Show log", "Troubleshoot"] });
    });
    it("Checking Favorite PDS dataset deletion", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parent = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        parent.contextValue = Constants.FAV_PROFILE_CONTEXT;
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: parent,
            profile: blockMocks.imperativeProfile,
        });
        node.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(vscode.workspace.fs, "delete");

        await DatasetActions.deleteDataset(node, blockMocks.testDatasetTree);

        expect(deleteSpy).toHaveBeenCalledWith(node.resourceUri, { recursive: false });
        expect(blockMocks.testDatasetTree.removeFavorite).toHaveBeenCalledWith(node);
    });
    it("Checking Favorite PDS Member deletion", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parent = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        parent.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;
        const child = new ZoweDatasetNode({ label: "child", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent });

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(vscode.workspace.fs, "delete").mockImplementation();

        await DatasetActions.deleteDataset(child, blockMocks.testDatasetTree);
        expect(deleteSpy).toHaveBeenCalledWith(child.resourceUri, { recursive: false });
        expect(blockMocks.testDatasetTree.removeFavorite).toHaveBeenCalledWith(child);
    });
    it("Checking Favorite PS dataset deletion", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parent = new ZoweDatasetNode({
            label: "HLQ.TEST.DELETE.PARENT",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        parent.contextValue = Constants.FAV_PROFILE_CONTEXT;
        const child = new ZoweDatasetNode({
            label: "HLQ.TEST.DELETE.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: parent,
            contextOverride: Constants.DS_DS_CONTEXT,
        });
        blockMocks.datasetSessionNode.children.push(child);
        blockMocks.testDatasetTree.mFavorites.push(parent);
        // Simulate context value update when PS is added as a favorite
        child.contextValue = Constants.DS_FAV_CONTEXT;
        blockMocks.testDatasetTree.mFavorites[0].children.push(child);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(vscode.workspace.fs, "delete").mockImplementation();
        await DatasetActions.deleteDataset(child, blockMocks.testDatasetTree);
        expect(deleteSpy).toHaveBeenCalledWith(child.resourceUri, { recursive: false });
        expect(blockMocks.testDatasetTree.removeFavorite).toHaveBeenCalledWith(child);
    });
    it("Checking incorrect dataset failed deletion attempt", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parent = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        parent.contextValue = "junk";
        const child = new ZoweDatasetNode({
            label: "child",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: parent,
            profile: blockMocks.imperativeProfile,
        });

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(vscode.workspace.fs, "delete").mockImplementation();
        deleteSpy.mockClear();
        await expect(DatasetActions.deleteDataset(child, blockMocks.testDatasetTree)).rejects.toThrow("Cannot delete, item invalid.");
        expect(deleteSpy).not.toHaveBeenCalled();
    });
});

describe("Dataset Actions Unit Tests - Function showAttributes", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        bindMvsApi(mvsApi);

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
        };
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking PS dataset attributes showing", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "AUSER.A1557332.A996850.TEST1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const datasetListSpy = jest.spyOn(blockMocks.mvsApi, "dataSet");
        datasetListSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [createDatasetAttributes(node.label.toString(), node.contextValue)],
            },
        });

        await DatasetActions.showAttributes(node, blockMocks.testDatasetTree);

        expect(datasetListSpy).toHaveBeenCalledWith(node.label.toString(), { attributes: true });
        expect(mocked(vscode.window.createWebviewPanel)).toHaveBeenCalled();
    });

    it("Checking PS dataset member attributes showing", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "AUSER.A1557332.A996850.TEST1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;
        const nodeMember = new ZoweDatasetNode({ label: "MEMBER1", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: node });
        nodeMember.contextValue = Constants.DS_MEMBER_CONTEXT;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const allMembersSpy = jest.spyOn(blockMocks.mvsApi, "allMembers");
        allMembersSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [createDSMemberAttributes(nodeMember.label.toString())],
            },
        });

        await DatasetActions.showAttributes(nodeMember, blockMocks.testDatasetTree);

        expect(allMembersSpy).toHaveBeenCalledWith(node.label.toString().toUpperCase(), {
            attributes: true,
            pattern: nodeMember.label.toString().toUpperCase(),
        });
        expect(mocked(vscode.window.createWebviewPanel)).toHaveBeenCalled();
    });

    it("Checking PS dataset attributes showing with Unverified Profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    validProfile: Validation.ValidationType.UNVERIFIED,
                };
            }),
        });
        const node = new ZoweDatasetNode({
            label: "AUSER.A1557332.A996850.TEST1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const datasetListSpy = jest.spyOn(blockMocks.mvsApi, "dataSet");
        datasetListSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [createDatasetAttributes(node.label.toString(), node.contextValue)],
            },
        });

        await DatasetActions.showAttributes(node, blockMocks.testDatasetTree);

        expect(datasetListSpy).toHaveBeenCalledWith(node.label.toString(), { attributes: true });
        expect(mocked(vscode.window.createWebviewPanel)).toHaveBeenCalled();
    });
    it("Checking PDS dataset attributes showing", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "AUSER.A1557332.A996850.TEST1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_PDS_CONTEXT;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const datasetListSpy = jest.spyOn(blockMocks.mvsApi, "dataSet");
        datasetListSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [createDatasetAttributes(node.label.toString(), node.contextValue)],
            },
        });

        await DatasetActions.showAttributes(node, blockMocks.testDatasetTree);

        expect(datasetListSpy).toHaveBeenCalledWith(node.label.toString(), { attributes: true });
        expect(mocked(vscode.window.createWebviewPanel)).toHaveBeenCalled();
    });
    it("Checking Favorite PS dataset attributes showing", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "AUSER.A1557332.A996850.TEST1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT + Constants.FAV_SUFFIX;
        const normalisedLabel = node.label as string;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const datasetListSpy = jest.spyOn(blockMocks.mvsApi, "dataSet");
        datasetListSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [createDatasetAttributes(normalisedLabel, node.contextValue)],
            },
        });

        await DatasetActions.showAttributes(node, blockMocks.testDatasetTree);

        expect(datasetListSpy).toHaveBeenCalledWith(normalisedLabel, { attributes: true });
        expect(mocked(vscode.window.createWebviewPanel)).toHaveBeenCalled();
    });
    it("Checking Favorite PDS dataset attributes showing", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "AUSER.A1557332.A996850.TEST1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;
        const normalisedLabel = node.label as string;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const datasetListSpy = jest.spyOn(blockMocks.mvsApi, "dataSet");
        datasetListSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [createDatasetAttributes(normalisedLabel, node.contextValue)],
            },
        });

        await DatasetActions.showAttributes(node, blockMocks.testDatasetTree);

        expect(datasetListSpy).toHaveBeenCalledWith(normalisedLabel, { attributes: true });
        expect(mocked(vscode.window.createWebviewPanel)).toHaveBeenCalled();
    });
    it("Checking failed attempt of dataset attributes showing (empty response)", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "AUSER.A1557332.A996850.TEST1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const datasetListSpy = jest.spyOn(blockMocks.mvsApi, "dataSet");
        datasetListSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });

        await expect(DatasetActions.showAttributes(node, blockMocks.testDatasetTree)).rejects.toEqual(
            Error("No matching names found for query: AUSER.A1557332.A996850.TEST1")
        );
        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith("No matching names found for query: AUSER.A1557332.A996850.TEST1", {
            items: ["Show log", "Troubleshoot"],
        });
        expect(mocked(vscode.window.createWebviewPanel)).not.toHaveBeenCalled();
    });
});

describe("Dataset Actions Unit Tests - Function copyDataSets", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        const pdsSessionNode = new ZoweDatasetNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            parentNode: datasetSessionNode,
            session,
            profile: profileInstance,
        });
        pdsSessionNode.contextValue = Constants.DS_PDS_CONTEXT;

        return {
            session,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
            pdsSessionNode,
        };
    }

    beforeEach(() => (mockClipboardData = null));
    afterAll(() => jest.restoreAllMocks());

    it("Checking copy the info of node to the clipboard", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.pdsSessionNode,
        });
        node.contextValue = Constants.DS_PDS_CONTEXT;
        const nodeList: ZoweDatasetNode[] = [node];
        jest.spyOn(node, "getChildren").mockResolvedValue([node]);
        await DatasetActions.copyDataSets(null, nodeList, null);
        expect(clipboard.readText()).toBe(
            '[{"profileName":"sestest","dataSetName":"HLQ.TEST.NODE","memberName":"HLQ.TEST.NODE","contextValue":"pds"}]'
        );
    });
    it("Checking copy the label of a member to the clipboard via quickkeys", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const parent = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        const child = new ZoweDatasetNode({ label: "child", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent });
        const selectedNodes = [child];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        await DatasetActions.copyDataSets(null, null, blockMocks.testDatasetTree);
        expect(clipboard.readText()).toBe('[{"profileName":"sestest","dataSetName":"parent","memberName":"child","contextValue":"member"}]');
    });
    it("Testing warning of multiple datasets with different types to be copied", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const Membernode = new ZoweDatasetNode({
            label: "HLQ.TEST.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.pdsSessionNode,
        });
        const pdsNode = new ZoweDatasetNode({
            label: "HLQ.TEST.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.pdsSessionNode,
        });
        pdsNode.contextValue = Constants.DS_PDS_CONTEXT;
        Membernode.contextValue = Constants.DS_MEMBER_CONTEXT;
        const nodeList: ZoweDatasetNode[] = [Membernode, pdsNode];
        await DatasetActions.copyDataSets(null, nodeList, null);
    });
});

describe("Dataset Actions Unit Tests - Function pasteDataSet", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        const pdsSessionNode = new ZoweDatasetNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            parentNode: datasetSessionNode,
            session,
            profile: profileInstance,
        });
        pdsSessionNode.contextValue = Constants.DS_PDS_CONTEXT;
        bindMvsApi(mvsApi);

        return {
            session,
            treeView,
            imperativeProfile,
            zosmfSession,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
            pdsSessionNode,
        };
    }

    it("Testing copySequentialDatasets() successfully runs within same profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.DATASET",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;
        clipboard.writeText(
            JSON.stringify([
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    profileName: blockMocks.imperativeProfile.name,
                    contextValue: Constants.DS_DS_CONTEXT,
                },
            ])
        );
        const testEnc = 5178;
        blockMocks.imperativeProfile.profile.encoding = testEnc;
        mocked(vscode.window.showInputBox).mockImplementationOnce((options) => {
            options.validateInput("nodeCopyCpy");
            return Promise.resolve("nodeCopyCpy");
        });
        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSet");
        copySpy.mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });
        mocked(vscode.window.withProgress).mockImplementation((prm, fnc) => {
            fnc();
            return Promise.resolve(prm);
        });
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, node)).resolves.not.toThrow();
    });

    it("Testing copySequentialDatasets() successfully runs on cross profile", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.DATASET",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;
        clipboard.writeText(
            JSON.stringify([
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    profileName: "sestest1",
                    contextValue: Constants.DS_DS_CONTEXT,
                },
            ])
        );
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            const progress = {
                report: jest.fn(),
            };
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            return callback(progress, token);
        });
        globalMocks.showInputBox.mockResolvedValueOnce("CopyNode");
        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetCrossLpar");
        copySpy.mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });
        jest.spyOn(DatasetActions, "determineReplacement").mockResolvedValueOnce("notFound");
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, node)).resolves.not.toThrow();
    });

    it("Testing copyPartitionedDatasets() successfully runs within same profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const parentNode = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        const dsNode = new ZoweDatasetNode({
            label: "dsNode",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            parentNode,
            session: blockMocks.zosmfSession,
            profile: blockMocks.imperativeProfile,
        });
        dsNode.contextValue = Constants.DS_PDS_CONTEXT;
        const profile = blockMocks.imperativeProfile;
        const fakeEncoding = 9999;
        profile.profile.encoding = fakeEncoding;
        jest.spyOn(dsNode, "getChildren").mockResolvedValue([parentNode, parentNode]);
        clipboard.writeText(
            JSON.stringify([
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    profileName: blockMocks.imperativeProfile.name,
                    contextValue: Constants.DS_PDS_CONTEXT,
                },
            ])
        );
        mocked(vscode.window.showInputBox).mockImplementationOnce((options) => {
            options.validateInput("pdsTest");
            return Promise.resolve("pdsTest");
        });
        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetMember");
        copySpy.mockResolvedValue({
            success: true,
            commandResponse: "myRes",
            apiResponse: {},
        });
        mocked(vscode.window.withProgress).mockImplementation((prm, fnc) => {
            fnc();
            return Promise.resolve(prm);
        });
        jest.spyOn(DatasetFSProvider.instance, "stat").mockReturnValue({ etag: "123ABC" } as any);
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, dsNode)).resolves.not.toThrow();
    });

    it("Testing copyPartitionedDatasets() successfully runs for copy pasting an empty PDS within same profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const parentNode = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        const dsNode = new ZoweDatasetNode({
            label: "dsNode",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: blockMocks.zosmfSession,
            profile: blockMocks.imperativeProfile,
        });
        dsNode.contextValue = Constants.DS_PDS_CONTEXT;
        const profile = blockMocks.imperativeProfile;
        const fakeEncoding = 9999;
        profile.profile.encoding = fakeEncoding;
        jest.spyOn(dsNode, "getChildren").mockResolvedValue([parentNode, parentNode]);
        clipboard.writeText(
            JSON.stringify([
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    memberName: "MEMBER1",
                    profileName: blockMocks.imperativeProfile.name,
                    contextValue: Constants.DS_PDS_CONTEXT,
                },
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    memberName: "No data sets found",
                    profileName: blockMocks.imperativeProfile.name,
                    contextValue: Constants.DS_PDS_CONTEXT,
                },
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    memberName: "MEMBER2",
                    profileName: blockMocks.imperativeProfile.name,
                    contextValue: Constants.DS_PDS_CONTEXT,
                },
            ])
        );
        mocked(vscode.window.showInputBox).mockImplementationOnce((options) => {
            options.validateInput("pdsTest");
            return Promise.resolve("pdsTest");
        });
        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetMember");
        copySpy.mockResolvedValue({
            success: true,
            commandResponse: "myRes",
            apiResponse: {},
        });
        mocked(vscode.window.withProgress).mockImplementation((prm, fnc) => {
            fnc();
            return Promise.resolve(prm);
        });
        jest.spyOn(DatasetFSProvider.instance, "stat").mockReturnValue({ etag: "123ABC" } as any);
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, dsNode)).resolves.not.toThrow();
        expect(copySpy).toHaveBeenCalledTimes(2);
    });

    it("Testing copyPartitionedDatasets() successfully runs on cross profile", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        const parentNode = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        const dsNode = new ZoweDatasetNode({
            label: "dsNode",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            parentNode,
            session: blockMocks.zosmfSession,
            profile: blockMocks.imperativeProfile,
        });
        dsNode.contextValue = Constants.DS_PDS_CONTEXT;
        clipboard.writeText(
            JSON.stringify([
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    profileName: "sestest1",
                    contextValue: Constants.DS_PDS_CONTEXT,
                },
            ])
        );
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            const progress = {
                report: jest.fn(),
            };
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            return callback(progress, token);
        });
        globalMocks.showInputBox.mockResolvedValueOnce("pdsTest");
        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetCrossLpar");
        copySpy.mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });
        jest.spyOn(DatasetActions, "determineReplacement").mockResolvedValueOnce("notFound");
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, dsNode)).resolves.not.toThrow();
    });

    it("Testing copyDatasetMembers() succesfully runs", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const memberNode = new ZoweDatasetNode({
            label: "memberNode",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.pdsSessionNode,
            profile: blockMocks.imperativeProfile,
        });
        memberNode.contextValue = Constants.DS_MEMBER_CONTEXT;
        clipboard.writeText(
            JSON.stringify([
                {
                    memberName: "TEST",
                    profileName: blockMocks.imperativeProfile.name,
                    contextValue: Constants.DS_MEMBER_CONTEXT,
                },
            ])
        );
        mocked(vscode.window.showInputBox).mockImplementationOnce((options) => {
            options.validateInput("pdsTest");
            return Promise.resolve("pdsTest");
        });
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            const progress = {
                report: jest.fn(),
            };
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            return callback(progress, token);
        });
        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetMember");
        copySpy.mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });
        jest.spyOn(DatasetActions, "determineReplacement").mockResolvedValueOnce("notFound");
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, memberNode)).resolves.not.toThrow();
    });

    it("Testing copyDatasetMembers() succesfully runs on cross profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const memberNode = new ZoweDatasetNode({
            label: "memberNode",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.pdsSessionNode,
            profile: blockMocks.imperativeProfile,
        });
        memberNode.contextValue = Constants.DS_MEMBER_CONTEXT;
        clipboard.writeText(
            JSON.stringify([
                {
                    memberName: "TEST",
                    profileName: "sesTest1",
                    contextValue: Constants.DS_MEMBER_CONTEXT,
                },
            ])
        );
        mocked(vscode.window.showInputBox).mockImplementationOnce((options) => {
            options.validateInput("pdsTest");
            return Promise.resolve("pdsTest");
        });
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            const progress = {
                report: jest.fn(),
            };
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            return callback(progress, token);
        });
        jest.spyOn(DatasetActions, "determineReplacement").mockResolvedValueOnce("notFound");
        const copySpyCrossLpar = jest.spyOn(blockMocks.mvsApi, "copyDataSetCrossLpar");
        copySpyCrossLpar.mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, memberNode)).resolves.not.toThrow();
    });

    it("Testing isCancellationRequested true", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        const parentNode = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        const dsNode = new ZoweDatasetNode({
            label: "dsNode",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            parentNode,
            session: blockMocks.zosmfSession,
            profile: blockMocks.imperativeProfile,
        });
        dsNode.contextValue = Constants.DS_PDS_CONTEXT;
        clipboard.writeText(
            JSON.stringify([
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    profileName: "sestest1",
                    contextValue: Constants.DS_PDS_CONTEXT,
                },
            ])
        );
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            const progress = {
                report: jest.fn(),
            };
            const token = {
                isCancellationRequested: true,
                onCancellationRequested: jest.fn(),
            };
            return callback(progress, token);
        });
        globalMocks.showInputBox.mockResolvedValueOnce("pdsTest");
        jest.spyOn(DatasetActions, "determineReplacement").mockResolvedValueOnce("notFound");
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, dsNode)).resolves.not.toThrow();

        //for sequential copy
        dsNode.contextValue = Constants.DS_DS_CONTEXT;
        clipboard.writeText(
            JSON.stringify([
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    profileName: "sestest1",
                    contextValue: Constants.DS_DS_CONTEXT,
                },
            ])
        );
        globalMocks.showInputBox.mockResolvedValueOnce("CopyNode");
        jest.spyOn(DatasetActions, "determineReplacement").mockResolvedValueOnce("notFound");
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, dsNode)).resolves.not.toThrow();

        //for DataSetMember Copy
        dsNode.contextValue = Constants.DS_MEMBER_CONTEXT;
        clipboard.writeText(
            JSON.stringify([
                {
                    memberName: "TEST",
                    profileName: "sesTest1",
                    contextValue: Constants.DS_MEMBER_CONTEXT,
                },
            ])
        );
        mocked(vscode.window.showInputBox).mockImplementationOnce((options) => {
            options.validateInput("pdsTest");
            return Promise.resolve("pdsTest");
        });
        const allmembersspy = jest.spyOn(blockMocks.mvsApi, "allMembers");
        allmembersspy.mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: { items: [{ member: "PDSTEST" }] },
        });
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, dsNode)).resolves.not.toThrow();
    });

    it("Should ask to replace the sequential and partitioned dataset if it already exists", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.DATASET",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });

        const spyListDs = jest.spyOn(blockMocks.mvsApi, "dataSet").mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ name: "HLQ.TEST.DATASET" }],
            },
        });
        mocked(vscode.window.showInputBox).mockResolvedValue("HLQ.TEST.DATASET");
        const spyAction = jest.fn();

        // SEQUENTIAL
        mocked(Gui.showMessage).mockResolvedValueOnce("Replace");
        node.contextValue = Constants.DS_DS_CONTEXT;
        clipboard.writeText(
            JSON.stringify([
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    profileName: blockMocks.imperativeProfile.name,
                    contextValue: Constants.DS_DS_CONTEXT,
                },
            ])
        );
        jest.spyOn(DatasetActions, "copySequentialDatasets").mockImplementationOnce(async (clipboardContent) => {
            await DatasetActions.copyProcessor(clipboardContent, "ps", spyAction);
        });
        spyAction.mockClear();
        mocked(Gui.showMessage).mockClear();
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, node)).resolves.not.toThrow();
        expect(spyAction).toHaveBeenCalled();
        expect(mocked(Gui.showMessage)).toHaveBeenCalled();

        //PARTITIONED
        mocked(Gui.showMessage).mockResolvedValueOnce("Replace");
        node.contextValue = Constants.DS_PDS_CONTEXT;
        clipboard.writeText(
            JSON.stringify([
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    profileName: blockMocks.imperativeProfile.name,
                    contextValue: Constants.DS_PDS_CONTEXT,
                },
            ])
        );
        jest.spyOn(DatasetActions, "copyPartitionedDatasets").mockImplementationOnce(async (clipboardContent) => {
            await DatasetActions.copyProcessor(clipboardContent, "po", spyAction);
        });
        spyAction.mockClear();
        mocked(Gui.showMessage).mockClear();
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, node)).resolves.not.toThrow();
        expect(spyAction).toHaveBeenCalled();
        expect(mocked(Gui.showMessage)).toHaveBeenCalled();

        spyListDs.mockReset().mockClear();
    });

    it("Testing pasteDataSet() fails and gives error with empty clipboard", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        vscode.env.clipboard.writeText("");
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            profile: blockMocks.imperativeProfile,
        });
        const errSpy = jest.spyOn(Gui, "errorMessage");
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, node)).resolves.not.toThrow();
        expect(errSpy).toHaveBeenCalled();
    });

    it("Testing refreshDataset() error handling", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testError = new Error("refreshDataset failed");
        const refreshSpy = jest.spyOn(blockMocks.pdsSessionNode, "getChildren").mockRejectedValueOnce(testError);
        await DatasetActions.refreshDataset(blockMocks.pdsSessionNode, blockMocks.testDatasetTree);
        expect(refreshSpy).toHaveBeenCalled();
        expect(mocked(Gui.errorMessage)).toHaveBeenCalled();
        expect(mocked(Gui.errorMessage).mock.calls[0][0]).toContain(testError.message);
    });

    it("Testing refreshDataset() running successfully", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const refreshSpy = jest.spyOn(blockMocks.pdsSessionNode, "getChildren").mockResolvedValueOnce(blockMocks.pdsMemberNode as any);
        await DatasetActions.refreshDataset(blockMocks.pdsSessionNode, blockMocks.testDatasetTree);
        expect(refreshSpy).toHaveBeenCalled();
    });

    it("If copyDataSetCrossLpar, copyDataSet is not present in mvsapi", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.DATASET",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;
        clipboard.writeText(
            JSON.stringify([
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    profileName: "sestest1",
                    contextValue: Constants.DS_DS_CONTEXT,
                },
            ])
        );
        blockMocks.mvsApi.copyDataSetCrossLpar = null as any;
        const errorSpy = jest.spyOn(Gui, "errorMessage").mockResolvedValue("Not supported");
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, node)).resolves.not.toThrow();
        expect(errorSpy).toHaveBeenCalled();

        //if copyDataSet() is not present in mvsapi
        clipboard.writeText(
            JSON.stringify([
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    profileName: blockMocks.imperativeProfile.name,
                    contextValue: Constants.DS_DS_CONTEXT,
                },
            ])
        );
        mocked(vscode.window.showInputBox).mockImplementationOnce((options) => {
            options.validateInput("nodeCopyCpy");
            return Promise.resolve("nodeCopyCpy");
        });
        blockMocks.mvsApi.copyDataSet = null as any;
        const errorCopySpy = jest.spyOn(Gui, "errorMessage").mockResolvedValue("Copying data sets is not supported.");
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, node)).resolves.not.toThrow();
        expect(errorCopySpy).toHaveBeenCalled();

        //for partitioned copyDataSetCrossLpar is not present in mvsapi
        node.contextValue = Constants.DS_PDS_CONTEXT;
        clipboard.writeText(
            JSON.stringify([
                {
                    dataSetName: "HLQ.TEST.BEFORE.NODE",
                    profileName: "sestest1",
                    contextValue: Constants.DS_PDS_CONTEXT,
                },
            ])
        );
        await expect(DatasetActions.pasteDataSet(blockMocks.testDatasetTree, node)).resolves.not.toThrow();
    });
});

describe("Dataset Actions Unit Tests - Function hMigrateDataSet", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindMvsApi(mvsApi);

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
            mockCheckCurrentProfile,
        };
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking that hMigrateDataSet successfully migrates a data set", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        const migrateSpy = jest.spyOn(blockMocks.mvsApi, "hMigrateDataSet");
        migrateSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });

        await DatasetActions.hMigrateDataSet(blockMocks.testDatasetTree, node);

        expect(migrateSpy).toHaveBeenCalledWith("HLQ.TEST.TO.NODE");
        expect(mocked(Gui.showMessage)).toHaveBeenCalled();
    });

    it("Checking that hMigrateDataSet throws an error if the user is invalid", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.profileInstance.validProfile = Validation.ValidationType.INVALID;
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        await DatasetActions.hMigrateDataSet(blockMocks.testDatasetTree, node);

        expect(mocked(Gui.errorMessage)).toHaveBeenCalled();
    });
    it("Checking PS dataset migrate for Unverified Profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: Validation.ValidationType.UNVERIFIED,
                };
            }),
        });
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        const migrateSpy = jest.spyOn(blockMocks.mvsApi, "hMigrateDataSet");
        migrateSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });

        await DatasetActions.hMigrateDataSet(blockMocks.testDatasetTree, node);

        expect(migrateSpy).toHaveBeenCalledWith("HLQ.TEST.TO.NODE");
        expect(mocked(Gui.showMessage)).toHaveBeenCalled();
    });
});

describe("Dataset Actions Unit Tests - Function hRecallDataSet", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindMvsApi(mvsApi);

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
            mockCheckCurrentProfile,
        };
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking PS dataset recall", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        const recallSpy = jest.spyOn(blockMocks.mvsApi, "hRecallDataSet");
        recallSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });

        await DatasetActions.hRecallDataSet(blockMocks.testDatasetTree, node);

        expect(recallSpy).toHaveBeenCalledWith("HLQ.TEST.TO.NODE");
        expect(mocked(Gui.showMessage)).toHaveBeenCalled();
    });

    it("Checking PS dataset recall for Unverified profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: Validation.ValidationType.UNVERIFIED,
                };
            }),
        });
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        const recallSpy = jest.spyOn(blockMocks.mvsApi, "hRecallDataSet");
        recallSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });

        await DatasetActions.hRecallDataSet(blockMocks.testDatasetTree, node);

        expect(recallSpy).toHaveBeenCalledWith("HLQ.TEST.TO.NODE");
        expect(mocked(Gui.showMessage)).toHaveBeenCalled();
    });
});
describe("Dataset Actions Unit Tests - Function showFileErrorDetails", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindMvsApi(mvsApi);

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
            mockCheckCurrentProfile,
        };
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking PS dataset with fileError as contextValue", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const testError = new imperative.ImperativeError({ msg: "test" });
        const testErrorString = JSON.stringify(testError, null, 2);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            contextOverride: Constants.DS_FILE_ERROR_CONTEXT,
        });

        const spyRecall = jest.spyOn(blockMocks.mvsApi, "hRecallDataSet");
        const spyLogError = mocked(ZoweLogger.error);

        // succeeded at recalling the dataset
        spyRecall.mockResolvedValueOnce({ success: true } as any);
        await DatasetActions.showFileErrorDetails(node);
        expect(spyRecall).toHaveBeenCalledWith("HLQ.TEST.TO.NODE");
        expect(mocked(Gui.errorMessage)).toHaveBeenCalled();
        spyRecall.mockReset();

        // failed recalling the dataset
        spyRecall.mockRejectedValueOnce(testError);
        await DatasetActions.showFileErrorDetails(node);
        expect(spyRecall).toHaveBeenCalledWith("HLQ.TEST.TO.NODE");
        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith(testError.message);
        expect(spyLogError).toHaveBeenCalledWith(testErrorString);
        spyRecall.mockReset();
        spyLogError.mockReset();

        // error details was already cached (this should always be the expected path)
        node.errorDetails = testError;
        await DatasetActions.showFileErrorDetails(node);
        expect(spyRecall).not.toHaveBeenCalled();
        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith(testError.message);
        expect(spyLogError).toHaveBeenCalledWith(testErrorString);
        spyRecall.mockReset();
        spyLogError.mockReset();

        // Invalid profile provided
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: jest.fn(),
                    validProfile: Validation.ValidationType.INVALID,
                };
            }),
        });
        await DatasetActions.showFileErrorDetails(node);
        expect(mocked(Gui.errorMessage)).toHaveBeenCalled();
        expect(spyRecall).not.toHaveBeenCalled();
        expect(spyLogError).not.toHaveBeenCalled();
    });
});

describe("Dataset Actions Unit Tests - Function createFile", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindMvsApi(mvsApi);
        mocked(treeView.reveal).mockReturnValue(new Promise((resolve) => resolve(null)));

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
            mockCheckCurrentProfile,
        };
    }
    it("Checking of proper configuration being picked up for different DS types", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockResolvedValue("test");
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const getChildrenSpy = jest.spyOn(blockMocks.datasetSessionNode, "getChildren");
        getChildrenSpy.mockResolvedValue([]);

        mocked(vscode.window.showQuickPick).mockResolvedValue("Allocate Data Set" as any);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Binary" as any);
        await DatasetActions.createFile(blockMocks.datasetSessionNode, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_BINARY);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: C" as any);
        await DatasetActions.createFile(blockMocks.datasetSessionNode, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_C);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Classic" as any);
        await DatasetActions.createFile(blockMocks.datasetSessionNode, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_CLASSIC);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Default" as any);
        await DatasetActions.createFile(blockMocks.datasetSessionNode, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_PDS);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        await DatasetActions.createFile(blockMocks.datasetSessionNode, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_PS);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Extended" as any);
        await DatasetActions.createFile(blockMocks.datasetSessionNode, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_EXTENDED);

        expect(createDataSetSpy).toHaveBeenCalledTimes(6);
    });
    it("Checking of proper configuration being picked up for different DS types with credentials prompt", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.profileInstance.promptCredentials.mockReturnValue(["fake", "fake", "fake"]);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockResolvedValue("test");
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.sessionWithoutCredentials,
        });
        node.setProfileToChoice(blockMocks.imperativeProfile);
        node.contextValue = Constants.DS_SESSION_CONTEXT;
        const getChildrenSpy = jest.spyOn(node, "getChildren");
        getChildrenSpy.mockResolvedValue([]);

        mocked(vscode.window.showQuickPick).mockResolvedValue("Allocate Data Set" as any);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Binary" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_BINARY);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: C" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_C);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Classic" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_CLASSIC);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Default" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_PDS);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_PS);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Extended" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_EXTENDED);

        expect(createDataSetSpy).toHaveBeenCalledTimes(6);
    });
    it("Checking of proper configuration being picked up for different DS types with credentials prompt for favorite", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.profileInstance.promptCredentials.mockReturnValue(["fake", "fake", "fake"]);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockResolvedValue("test");
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.sessionWithoutCredentials,
        });
        node.contextValue = Constants.DS_SESSION_CONTEXT + Constants.FAV_SUFFIX;
        const getChildrenSpy = jest.spyOn(node, "getChildren");
        getChildrenSpy.mockResolvedValue([]);

        mocked(vscode.window.showQuickPick).mockResolvedValue("Allocate Data Set" as any);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Binary" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_BINARY);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: C" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_C);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Classic" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_CLASSIC);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Default" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_PDS);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_PS);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Extended" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_EXTENDED);

        expect(createDataSetSpy).toHaveBeenCalledTimes(6);
        createDataSetSpy.mockClear();
    });
    it("Checking PS dataset creation", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        mocked(vscode.window.showQuickPick).mockResolvedValue("Allocate Data Set" as any);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);

        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_PS);
        expect(createDataSetSpy).toHaveBeenCalledWith(zosfiles.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, "TEST", {
            alcunit: "CYL",
            blksize: 6160,
            dsorg: "PS",
            lrecl: 80,
            primary: 1,
            recfm: "FB",
            responseTimeout: undefined,
        });
    });
    it("Checking PS dataset errored creation with Unverified profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: Validation.ValidationType.UNVERIFIED,
                };
            }),
        });

        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockResolvedValue("test");
        mocked(vscode.window.showQuickPick).mockResolvedValue("Allocate Data Set" as any);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        createDataSetSpy.mockRejectedValueOnce(Error("Generic Error"));
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        try {
            await DatasetActions.createFile(node, blockMocks.testDatasetTree);
        } catch (err) {
            // do nothing
        }

        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith("Generic Error", { items: ["Show log", "Troubleshoot"] });
        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenLastCalledWith(Constants.SETTINGS_DS_DEFAULT_PS);
        expect(createDataSetSpy).toHaveBeenCalledWith(zosfiles.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, "TEST", {
            alcunit: "CYL",
            blksize: 6160,
            dsorg: "PS",
            lrecl: 80,
            primary: 1,
            recfm: "FB",
            responseTimeout: undefined,
        });
    });
    it("Checking dataset attempt of creation with empty type", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockResolvedValue("test");
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith("Operation cancelled");
        expect(createDataSetSpy).not.toHaveBeenCalled();
    });
    it("Tests that user can edit the node label", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.testDatasetTree.createFilterString.mockReturnValue("NODE1,NODE.*");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([null]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        // 1st step: User names DS
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("test");

        // 2nd step: User selects DS type
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);

        // 3rd step: User selects Edit attributes
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Edit Attributes" as any);

        // 4th step: User tries to edit Node Label
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        const selectedItem: vscode.QuickPickItem = { label: "Data Set Name" };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(selectedItem);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("TEST.EDIT");

        // Then they try to allocate
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce({ label: "Allocate Data Set" });

        await DatasetActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toHaveBeenCalledWith(zosfiles.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, "TEST.EDIT", {
            alcunit: "CYL",
            blksize: 6160,
            dsorg: "PS",
            lrecl: 80,
            primary: 1,
            recfm: "FB",
        });
    });

    it("Tests that user can edit the attributes and save as new template", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.testDatasetTree.createFilterString.mockReturnValue("NODE1,NODE.*");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([null]);

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        // 1st step: User names DS
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("test");

        // 2nd step: User selects DS type
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);

        // 3rd step: User selects Edit attributes
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Edit Attributes" as any);

        // 4th step: User tries to edit Record Length
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        const selectedItem: vscode.QuickPickItem = { label: "Allocation Unit" };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(selectedItem);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("TRK");

        // Then they try to allocate
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce({ label: "Allocate Data Set" });

        const templateSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce("Save");
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("TestTemplate");
        const addTempSpy = jest.spyOn(blockMocks.testDatasetTree, "addDsTemplate");
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toHaveBeenCalledWith(zosfiles.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, "TEST", {
            alcunit: "TRK",
            blksize: 6160,
            dsorg: "PS",
            lrecl: 80,
            primary: 1,
            recfm: "FB",
        });
        expect(templateSpy).toHaveBeenCalled();
        expect(addTempSpy).toHaveBeenCalled();
        templateSpy.mockClear();
        addTempSpy.mockClear();
    });
    it("Tests that user can edit the attributes and don't save as new template", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.testDatasetTree.createFilterString.mockReturnValue("NODE1,NODE.*");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([null]);

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        // 1st step: User names DS
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("test");

        // 2nd step: User selects DS type
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);

        // 3rd step: User selects Edit attributes
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Edit Attributes" as any);

        // 4th step: User tries to edit Record Length
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        const selectedItem: vscode.QuickPickItem = { label: "Allocation Unit" };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(selectedItem);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("TRK");

        // Then they try to allocate
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce({ label: "Allocate Data Set" });

        const templateSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce(undefined);
        const addTempSpy = jest.spyOn(blockMocks.testDatasetTree, "addDsTemplate");
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toHaveBeenCalledWith(zosfiles.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, "TEST", {
            alcunit: "TRK",
            blksize: 6160,
            dsorg: "PS",
            lrecl: 80,
            primary: 1,
            recfm: "FB",
        });
        expect(templateSpy).toHaveBeenCalled();
        expect(addTempSpy).toHaveBeenCalledTimes(0);
        templateSpy.mockClear();
        addTempSpy.mockClear();
    });
    it("Checking dataset creation of saved template", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        blockMocks.testDatasetTree.getDsTemplates.mockReturnValue([
            {
                TEMPTST: {
                    alcunit: "CYL",
                    blksize: 6160,
                    dsorg: "PO",
                    lrecl: 80,
                    primary: 1,
                    recfm: "FB",
                },
            },
        ]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        mocked(vscode.window.showQuickPick).mockResolvedValue("Allocate Data Set" as any);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("TEMPTST" as any);
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toHaveBeenCalledWith(zosfiles.CreateDataSetTypeEnum.DATA_SET_PARTITIONED, "TEST", {
            alcunit: "CYL",
            blksize: 6160,
            dsorg: "PO",
            lrecl: 80,
            primary: 1,
            recfm: "FB",
            responseTimeout: undefined,
        });
    });
    it("Checking correct opCancelled message with no dsName returned", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue(undefined);
        const createDataSetSpy = jest.spyOn(Gui, "showMessage");
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toHaveBeenCalledWith("Operation cancelled");
    });
    it("Checking opCancelled message shown when no ds type chosen", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);
        const createDataSetSpy = jest.spyOn(Gui, "showMessage");
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toHaveBeenCalledWith("Operation cancelled");
    });
    it("Checking opCancelled message shown when user escapes allocate or edit attributes options", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);
        const createDataSetSpy = jest.spyOn(Gui, "showMessage");
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toHaveBeenCalledWith("Operation cancelled");
    });
    it("Checking opCancelled message shown when user escapes during edit attributes", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Edit Attributes" as any);
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        const selectedItem: vscode.QuickPickItem = undefined as any;
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(selectedItem);
        const createDataSetSpy = jest.spyOn(Gui, "showMessage");
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toHaveBeenCalledWith("Operation cancelled");
    });
    it("Checking opCancelled message shown when no template name supplied", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.testDatasetTree.createFilterString.mockReturnValue("NODE1,NODE.*");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([null]);

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.contextValue = Constants.DS_DS_CONTEXT;

        // 1st step: User names DS
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("test");

        // 2nd step: User selects DS type
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);

        // 3rd step: User selects Edit attributes
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Edit Attributes" as any);

        // 4th step: User tries to edit Record Length
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        const selectedItem: vscode.QuickPickItem = { label: "Allocation Unit" };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(selectedItem);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("TRK");

        // Then they try to allocate
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce({ label: "Allocate Data Set" });

        const templateSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce("Save");
        mocked(vscode.window.showInputBox).mockResolvedValueOnce(undefined);
        const opCancelledSpy = jest.spyOn(Gui, "showMessage");
        const addTempSpy = jest.spyOn(blockMocks.testDatasetTree, "addDsTemplate");
        await DatasetActions.createFile(node, blockMocks.testDatasetTree);

        expect(templateSpy).toHaveBeenCalled();
        expect(addTempSpy).toHaveBeenCalledTimes(0);
        expect(opCancelledSpy).toHaveBeenCalledWith("Operation cancelled");
        templateSpy.mockClear();
        addTempSpy.mockClear();
    });
});

describe("Dataset Actions Unit Tests - Function allocateLike", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const testNode = new ZoweDatasetNode({
            label: "nodePDS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: datasetSessionNode,
        });
        const testSDSNode = new ZoweDatasetNode({
            label: "nodeSDS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: datasetSessionNode,
        });
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const mvsApi = createMvsApi(imperativeProfile);
        const quickPickItem = new FilterDescriptor(datasetSessionNode.label.toString());
        const quickPickContent = createQuickPickContent("", [quickPickItem], "");

        bindMvsApi(mvsApi);
        testNode.contextValue = Constants.DS_PDS_CONTEXT;
        testSDSNode.contextValue = Constants.DS_DS_CONTEXT;

        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        mocked(Profiles.getInstance).mockReturnValue(profileInstance);
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        jest.spyOn(datasetSessionNode, "getChildren").mockResolvedValue([testNode, testSDSNode]);
        testDatasetTree.createFilterString.mockReturnValue("test");
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue(quickPickItem);

        return {
            session,
            treeView,
            testNode,
            quickPickContent,
            testSDSNode,
            quickPickItem,
            profileInstance,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            testDatasetTree,
        };
    }

    it("Tests that allocateLike works if called from the command palette", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const errorHandlingSpy = jest.spyOn(AuthUtils, "errorHandling");

        await DatasetActions.allocateLike(blockMocks.testDatasetTree);

        expect(errorHandlingSpy).toHaveBeenCalledTimes(0);
        expect(blockMocks.quickPickContent.show).toHaveBeenCalledTimes(1);
    });
    it("Tests that allocateLike works if called from the context menu", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const errorHandlingSpy = jest.spyOn(AuthUtils, "errorHandling");

        await DatasetActions.allocateLike(blockMocks.testDatasetTree, blockMocks.testNode);

        expect(errorHandlingSpy).toHaveBeenCalledTimes(0);
        expect(blockMocks.quickPickContent.show).toHaveBeenCalledTimes(0);
    });
    it("Tests that the dataset filter string is updated on the session, to include the new node's name", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        await DatasetActions.allocateLike(blockMocks.testDatasetTree, blockMocks.testNode);

        expect(blockMocks.datasetSessionNode.pattern).toEqual("TEST");
    });
    it("Tests that allocateLike fails if no profile is selected", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(null);

        await DatasetActions.allocateLike(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith("You must select a profile.");
    });
    it("Tests that allocateLike fails if no new dataset name is provided", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.showInputBox).mockResolvedValueOnce(null);

        await DatasetActions.allocateLike(blockMocks.testDatasetTree, blockMocks.testNode);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith("You must enter a new data set name.");
    });
    it("Tests that allocateLike fails if error is thrown", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const errorHandlingSpy = jest.spyOn(AuthUtils, "errorHandling");
        const errorMessage = new Error("Test error");
        jest.spyOn(blockMocks.mvsApi, "allocateLikeDataSet").mockRejectedValue(errorMessage);

        try {
            await DatasetActions.allocateLike(blockMocks.testDatasetTree);
        } catch (err) {
            // do nothing
        }

        expect(errorHandlingSpy).toHaveBeenCalledTimes(1);
        expect(errorHandlingSpy).toHaveBeenCalledWith(
            errorMessage,
            expect.objectContaining({ apiType: ZoweExplorerApiType.Mvs, scenario: "Unable to create data set." })
        );
    });
});

describe("Dataset Actions Unit Tests - Function confirmJobSubmission", () => {
    function createBlockMocks(): void {
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
    }
    it("Should use use local JCL doc name for confirmJobSubmission", async () => {
        createGlobalMocks();
        createBlockMocks();
        jest.spyOn(vscode.workspace, "getConfiguration").mockImplementation(
            () =>
                ({
                    get: () => Constants.JOB_SUBMIT_DIALOG_OPTS[1],
                } as any)
        );
        jest.spyOn(Gui, "warningMessage").mockResolvedValue({
            title: "Submit",
        });
        await expect(DatasetActions.confirmJobSubmission("Profile\\test.jcl", true)).resolves.toEqual(true);
    });
});

describe("Dataset Actions Unit Tests - Function getDsTypePropertiesFromWorkspaceConfig", () => {
    it("Should use use local JCL doc name for confirmJobSubmission", () => {
        createGlobalMocks();
        const options = createWorkspaceConfiguration();
        // const opt = DatasetActions.getDsTypePropertiesFromWorkspaceConfig(options);
        jest.spyOn(options, "get").mockImplementation((attr: string) => {
            const pdse = {
                dsntype: "LIBRARY",
                dsorg: "PO",
                alcunit: "CYL",
                primary: 10,
                secondary: 3,
                dirblk: 25,
                recfm: "FB",
                blksize: 27920,
                lrecl: 80,
            };
            return pdse[attr];
        });
        expect(DatasetActions.getDsTypePropertiesFromWorkspaceConfig(options).dsntype).toBe("LIBRARY");
        expect(DatasetActions.getDsTypePropertiesFromWorkspaceConfig(options).dsorg).toBe("PO");
        expect(DatasetActions.getDsTypePropertiesFromWorkspaceConfig(options).alcunit).toBe("CYL");
        expect(DatasetActions.getDsTypePropertiesFromWorkspaceConfig(options).primary).toBe(10);
        expect(DatasetActions.getDsTypePropertiesFromWorkspaceConfig(options).secondary).toBe(3);
        expect(DatasetActions.getDsTypePropertiesFromWorkspaceConfig(options).dirblk).toBe(25);
        expect(DatasetActions.getDsTypePropertiesFromWorkspaceConfig(options).recfm).toBe("FB");
        expect(DatasetActions.getDsTypePropertiesFromWorkspaceConfig(options).blksize).toBe(27920);
        expect(DatasetActions.getDsTypePropertiesFromWorkspaceConfig(options).lrecl).toBe(80);
    });
});

describe("Dataset Actions Unit Tests - function copyName", () => {
    const datasetSessionNode = createDatasetSessionNode(createISession(), createIProfile());
    it("copies the correct path for a PDS", async () => {
        const pds = new ZoweDatasetNode({
            label: "A.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_PDS_CONTEXT,
            parentNode: datasetSessionNode,
        });
        await DatasetActions.copyName(pds);
        expect(mocked(vscode.env.clipboard.writeText)).toHaveBeenCalledWith("A.PDS");
    });

    it("copies the correct path for a PDS member", async () => {
        const pds = new ZoweDatasetNode({
            label: "A.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: Constants.DS_PDS_CONTEXT,
            parentNode: datasetSessionNode,
        });
        const pdsMember = new ZoweDatasetNode({
            label: "MEM1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_MEMBER_CONTEXT,
            parentNode: pds,
        });
        await DatasetActions.copyName(pdsMember);
        expect(mocked(vscode.env.clipboard.writeText)).toHaveBeenCalledWith("A.PDS(MEM1)");
    });

    it("copies the correct path for a DS", async () => {
        const ds = new ZoweDatasetNode({
            label: "A.DS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_DS_CONTEXT,
            parentNode: datasetSessionNode,
        });
        await DatasetActions.copyName(ds);
        expect(mocked(vscode.env.clipboard.writeText)).toHaveBeenCalledWith("A.DS");
    });

    it("copies the correct path for a migrated DS", async () => {
        const ds = new ZoweDatasetNode({
            label: "A.DS.MIGRAT",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
            parentNode: datasetSessionNode,
        });
        await DatasetActions.copyName(ds);
        expect(mocked(vscode.env.clipboard.writeText)).toHaveBeenCalledWith("A.DS.MIGRAT");
    });
    it("copies the correct path for a VSAM data set", async () => {
        const vsam = new ZoweDatasetNode({
            label: "A.VSAM",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.VSAM_CONTEXT,
            parentNode: datasetSessionNode,
        });
        await DatasetActions.copyName(vsam);
        expect(mocked(vscode.env.clipboard.writeText)).toHaveBeenCalledWith("A.VSAM");
    });
});

describe("Dataset Actions Unit Tests - Function zoom", () => {
    function createBlockMocks() {
        const session = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, createTreeView());
        const mvsApi = createMvsApi(imperativeProfile);
        bindMvsApi(mvsApi);

        // Simulate a text editor with a selection
        const selection = { start: 0, end: 10, isEmpty: false };
        const document = {
            getText: jest.fn(),
            uri: vscode.Uri.parse("file:///fake/file"),
        };
        const editor = {
            document,
            selection,
            viewColumn: 1,
        };

        return {
            session,
            imperativeProfile,
            datasetSessionNode,
            profileInstance,
            testDatasetTree,
            mvsApi,
            document,
            editor,
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should show a warning if no active editor", async () => {
        createGlobalMocks();
        Object.defineProperty(vscode.window, "activeTextEditor", { value: undefined, configurable: true });
        const warningSpy = jest.spyOn(Gui, "warningMessage");

        await DatasetActions.zoom();

        expect(warningSpy).toHaveBeenCalledWith("No active editor open. Please open a file and select text to open a data set.");
    });

    it("should show a warning if no selection is made", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        blockMocks.document.getText.mockReturnValue("");
        Object.defineProperty(vscode.window, "activeTextEditor", { value: blockMocks.editor, configurable: true });
        const errorSpy = jest.spyOn(Gui, "warningMessage");

        await DatasetActions.zoom();

        expect(errorSpy).toHaveBeenCalledWith("No selection to open.");
    });

    it("should show a warning if selection is not a valid dataset name", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        blockMocks.document.getText.mockReturnValue("INVALID@DATASET");
        Object.defineProperty(vscode.window, "activeTextEditor", { value: blockMocks.editor, configurable: true });
        jest.spyOn(DatasetUtils, "extractDataSetAndMember").mockReturnValue({ dataSetName: "INVALID@DATASET", memberName: "" });
        jest.spyOn(DatasetUtils, "validateDataSetName").mockReturnValue(false);
        const errorSpy = jest.spyOn(Gui, "warningMessage");

        await DatasetActions.zoom();

        expect(errorSpy).toHaveBeenCalledWith("Selection is not a valid data set name.");
    });

    it("should show a warning if selection is not a valid member name", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        blockMocks.document.getText.mockReturnValue("MY.DATASET(INVALID@MEM)");
        Object.defineProperty(vscode.window, "activeTextEditor", { value: blockMocks.editor, configurable: true });
        jest.spyOn(DatasetUtils, "extractDataSetAndMember").mockReturnValue({ dataSetName: "MY.DATASET", memberName: "INVALID@MEM" });
        jest.spyOn(DatasetUtils, "validateMemberName").mockReturnValue(false);
        const errorSpy = jest.spyOn(Gui, "warningMessage");

        await DatasetActions.zoom();

        expect(errorSpy).toHaveBeenCalledWith("Selection is not a valid data set member name.");
    });

    it("should show a message if no profiles are available", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        blockMocks.document.getText.mockReturnValue("MY.DATASET");
        Object.defineProperty(vscode.window, "activeTextEditor", { value: blockMocks.editor, configurable: true });
        jest.spyOn(DatasetUtils, "extractDataSetAndMember").mockReturnValue({ dataSetName: "MY.DATASET", memberName: "" });
        jest.spyOn(DatasetUtils, "validateDataSetName").mockReturnValue(true);

        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue([]),
            configurable: true,
        });
        const showMsgSpy = jest.spyOn(Gui, "showMessage");

        await DatasetActions.zoom();

        expect(showMsgSpy).toHaveBeenCalledWith("No profiles available");
    });

    it("should cancel if user does not select a profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        blockMocks.document.getText.mockReturnValue("MY.DATASET");
        Object.defineProperty(vscode.window, "activeTextEditor", { value: blockMocks.editor, configurable: true });
        jest.spyOn(DatasetUtils, "extractDataSetAndMember").mockReturnValue({ dataSetName: "MY.DATASET", memberName: "" });
        jest.spyOn(DatasetUtils, "validateDataSetName").mockReturnValue(true);

        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue(["prof1", "prof2"]),
            configurable: true,
        });
        jest.spyOn(Gui, "showQuickPick").mockResolvedValueOnce(undefined);
        const infoMsgSpy = jest.spyOn(Gui, "infoMessage");

        await DatasetActions.zoom();

        expect(infoMsgSpy).toHaveBeenCalledWith(DatasetActions.localizedStrings.opCancelled);
    });

    it("should show an error if profile is invalid", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        blockMocks.document.getText.mockReturnValue("MY.DATASET");
        Object.defineProperty(vscode.window, "activeTextEditor", { value: blockMocks.editor, configurable: true });
        jest.spyOn(DatasetUtils, "extractDataSetAndMember").mockReturnValue({ dataSetName: "MY.DATASET", memberName: "" });
        jest.spyOn(DatasetUtils, "validateDataSetName").mockReturnValue(true);

        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue(["prof1"]),
            configurable: true,
        });
        jest.spyOn(Profiles, "getInstance").mockReturnValue({
            allProfiles: [{ name: "prof1" }],
            loadNamedProfile: jest.fn().mockReturnValue({ name: "prof1" }),
            checkCurrentProfile: jest.fn(),
            validProfile: Validation.ValidationType.INVALID,
        } as any);

        const errorMsgSpy = jest.spyOn(Gui, "errorMessage");

        await DatasetActions.zoom();

        expect(errorMsgSpy).toHaveBeenCalledWith(DatasetActions.localizedStrings.profileInvalid);
    });

    it("should show a warning if dataset/member does not exist (FileSystemError)", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        blockMocks.document.getText.mockReturnValue("MY.DATASET(MEMBER1)");
        Object.defineProperty(vscode.window, "activeTextEditor", { value: blockMocks.editor, configurable: true });
        jest.spyOn(DatasetUtils, "extractDataSetAndMember").mockReturnValue({ dataSetName: "MY.DATASET", memberName: "MEMBER1" });
        jest.spyOn(DatasetUtils, "validateMemberName").mockReturnValue(true);

        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue(["prof1"]),
            configurable: true,
        });
        jest.spyOn(Profiles, "getInstance").mockReturnValue({
            allProfiles: [{ name: "prof1" }],
            loadNamedProfile: jest.fn().mockReturnValue({ name: "prof1" }),
            checkCurrentProfile: jest.fn(),
            validProfile: Validation.ValidationType.UNVERIFIED,
        } as any);

        jest.spyOn(vscode.workspace.fs, "readFile").mockRejectedValueOnce(new vscode.FileSystemError("not found"));
        const warningSpy = jest.spyOn(Gui, "warningMessage");

        await DatasetActions.zoom();

        expect(warningSpy).toHaveBeenCalledWith("Data set member {0} does not exist or cannot be opened in data set {1}.");
    });

    it("should call AuthUtils.errorHandling on other errors", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        blockMocks.document.getText.mockReturnValue("MY.DATASET");
        Object.defineProperty(vscode.window, "activeTextEditor", { value: blockMocks.editor, configurable: true });
        jest.spyOn(DatasetUtils, "extractDataSetAndMember").mockReturnValue({ dataSetName: "MY.DATASET", memberName: "" });
        jest.spyOn(DatasetUtils, "validateDataSetName").mockReturnValue(true);

        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue(["prof1"]),
            configurable: true,
        });
        jest.spyOn(Profiles, "getInstance").mockReturnValue({
            allProfiles: [{ name: "prof1" }],
            loadNamedProfile: jest.fn().mockReturnValue({ name: "prof1" }),
            checkCurrentProfile: jest.fn(),
            validProfile: Validation.ValidationType.UNVERIFIED,
        } as any);

        const testError = new Error("Some error");
        jest.spyOn(vscode.workspace.fs, "readFile").mockRejectedValueOnce(testError);
        const authUtilsSpy = jest.spyOn(AuthUtils, "errorHandling").mockResolvedValue(undefined);

        await DatasetActions.zoom();

        expect(authUtilsSpy).toHaveBeenCalledWith(
            testError,
            expect.objectContaining({
                apiType: ZoweExplorerApiType.Mvs,
                profile: { name: "prof1" },
                scenario: "Opening data set failed.",
            })
        );
    });

    it("should open the dataset/member if all is valid", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        blockMocks.document.getText.mockReturnValue("MY.DATASET(MEMBER1)");
        Object.defineProperty(vscode.window, "activeTextEditor", { value: blockMocks.editor, configurable: true });
        jest.spyOn(DatasetUtils, "extractDataSetAndMember").mockReturnValue({ dataSetName: "MY.DATASET", memberName: "MEMBER1" });
        jest.spyOn(DatasetUtils, "validateMemberName").mockReturnValue(true);

        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue(["prof1"]),
            configurable: true,
        });
        jest.spyOn(Profiles, "getInstance").mockReturnValue({
            allProfiles: [{ name: "prof1" }],
            loadNamedProfile: jest.fn().mockReturnValue({ name: "prof1" }),
            checkCurrentProfile: jest.fn(),
            validProfile: Validation.ValidationType.UNVERIFIED,
        } as any);

        jest.spyOn(vscode.workspace.fs, "readFile").mockResolvedValueOnce(Buffer.from("data"));
        const execCmdSpy = jest.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);

        await DatasetActions.zoom();

        expect(execCmdSpy).toHaveBeenCalledWith("vscode.open", expect.anything(), {
            preview: false,
            viewColumn: 1,
        });
    });
});
