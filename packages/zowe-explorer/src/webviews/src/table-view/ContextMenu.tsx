import type { Table } from "@zowe/zowe-explorer-api";
import { useCallback, useRef, useState } from "preact/hooks";
import { CellContextMenuEvent, ColDef } from "ag-grid-community";
import { ControlledMenu } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import { ContextMenuItem } from "./ContextMenuItem";

type MousePt = { x: number; y: number };

export type ContextMenuProps = {
  selectRow: boolean;
  selectedRows: Table.RowData[] | null | undefined;
  clickedRow: Table.RowData;
  options: Table.ContextMenuOption[];
  colDef: ColDef;
};

/**
 * React hook that returns a prepared context menu component and its related states.
 *
 * @param contextMenu The props for the context menu component (options)
 * @returns The result of the hook, with the component to render, open state and cell callback
 */
export const useContextMenu = (contextMenu: ContextMenuProps) => {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<MousePt>({ x: 0, y: 0 });

  const gridRefs = useRef<any>({
    colDef: null,
    selectedRows: [],
    clickedRow: null,
    field: undefined,
    rowIndex: null,
  });

  /* Opens the context menu and sets the anchor point to mouse coordinates */
  const openMenu = (e: PointerEvent | null | undefined) => {
    if (!e) {
      return;
    }

    setAnchor({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  /* Removes 'focused-ctx-menu' class name from other grid cells when context menu is closed. */
  const removeContextMenuClass = () => {
    const elems = document.querySelectorAll("div[role='gridcell']");
    elems.forEach((elem) => elem.classList.remove("focused-ctx-menu"));
  };

  const cellMenu = useCallback(
    (event: CellContextMenuEvent) => {
      // Check if a cell is focused. If so, keep the border around the grid cell by adding a "focused cell" class.
      const focusedCell = event.api.getFocusedCell();
      if (contextMenu.selectRow && focusedCell) {
        // Only apply the border to grid cell divs contained in valid cells
        if (event.event?.target && (event.event?.target as Element).classList.contains("ag-cell-value")) {
          const lastCell = (event.event?.target as Element).parentElement?.parentElement!;
          lastCell.classList.add("focused-ctx-menu");
        }
      }

      // Cache the current column, selected rows and clicked row for later use
      gridRefs.current = {
        colDef: event.colDef,
        selectedRows: event.api.getSelectedRows(),
        clickedRow: event.data,
        field: event.colDef.field,
        rowIndex: event.rowIndex,
      };

      openMenu(event.event as PointerEvent);
    },
    [contextMenu.selectRow, gridRefs.current.selectedRows]
  );

  return {
    open,
    callback: cellMenu,
    component: open ? (
      <ControlledMenu
        state="open"
        anchorPoint={anchor}
        direction="right"
        onClose={() => {
          removeContextMenuClass();
          setOpen(false);
        }}
      >
        {ContextMenu(gridRefs.current, contextMenu.options)}
      </ControlledMenu>
    ) : null,
  };
};

export type ContextMenuElemProps = {
  anchor: MousePt;
  menuItems: Table.ContextMenuOption[];
};

export const ContextMenu = (gridRefs: any, menuItems: Table.ContextMenuOption[]) => {
  return menuItems?.map((item, i) => (
    <ContextMenuItem key={`${item.command}-ctx-menu-${i}`} item={item} gridRefs={gridRefs} keyPrefix={`${item.command}-ctx-menu-${i}`} />
  ));
};
