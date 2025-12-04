"use client";

import type { ColumnDef, RowData } from "@tanstack/react-table";
import { Download, MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- TYPES -------------------------------------------------------------------

export type DataProps = {
  id: string | number;
  order: number;
  customer: {
    name: string;
    image: string;
  };
  date: string;
  quantity: number;
  action?: React.ReactNode;
};

// --- TABLE META AUGMENTATION (for meta.onDownload) ---------------------------

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    onDownload?: (id: string | number) => void;
  }
}

// --- COLUMNS -----------------------------------------------------------------

export const columns: ColumnDef<DataProps>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <div className="xl:w-16">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <span>{row.getValue("id")}</span>,
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => <span>{row.getValue("date")}</span>,
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
    cell: ({ row }) => <span>{row.getValue("quantity")}</span>,
  },
  {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell: ({ row, table }) => {
      const onDownload = table.options.meta?.onDownload;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              className="bg-transparent ring-offset-transparent hover:bg-transparent hover:ring-0 hover:ring-transparent"
            >
              <span className="sr-only">Open menu</span>
              <MoreVertical className="h-4 w-4 text-default-800" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="p-0" align="end">
            <DropdownMenuItem
              className="p-2 border-b text-default-700 group focus:bg-default focus:text-primary-foreground rounded-none"
              onClick={() => onDownload?.(row.original.id)}
            >
              <Download className="w-4 h-4 me-1.5" />
              Download
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];