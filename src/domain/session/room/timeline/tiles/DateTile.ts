import {ITile, TileShape, EmitUpdateFn} from "./ITile";
import {UpdateAction} from "../UpdateAction";
import {BaseEntry} from "../../../../../matrix/room/timeline/entries/BaseEntry";
import {BaseEventEntry} from "../../../../../matrix/room/timeline/entries/BaseEventEntry";
import {ViewModel} from "../../../../ViewModel";
import type {Options} from "../../../../ViewModel";

/**
 * edge cases:
 *  - be able to remove the tile in response to the sibling changing,
 *    probably by letting updateNextSibling/updatePreviousSibling
 *    return an UpdateAction and change TilesCollection accordingly.
 *    this is relevant when next becomes undefined there when
 *    a pending event is removed on remote echo.
 * */

export class DateTile extends ViewModel implements ITile<BaseEventEntry> {
    private _emitUpdate?: EmitUpdateFn;
    private _dateString?: string;
    
    constructor(private _firstTileInDay: ITile<BaseEventEntry>, options: Options) {
        super(options);
    }

    setUpdateEmit(emitUpdate: EmitUpdateFn): void {
        this._emitUpdate = emitUpdate;
    }

    get upperEntry(): BaseEventEntry {
        return this.refEntry;
    }

    get lowerEntry(): BaseEventEntry {
        return this.refEntry;
    }

    /** the entry reference by this datetile, e.g. the entry of the first tile for this day */
    private get refEntry(): BaseEventEntry {
        // lowerEntry is the first entry... i think?
        // so given the date header always comes before,
        // this is our closest entry.
        return this._firstTileInDay.lowerEntry;
    }

    compare(tile: ITile<BaseEntry>): number {
        return this.compareEntry(tile.upperEntry);
    }

    get date(): string {
        if (!this._dateString) {
            const date = new Date(this.refEntry.timestamp);
            this._dateString = date.toLocaleDateString({}, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        return this._dateString;
    }

    get shape(): TileShape {
        return TileShape.DateHeader;
    }

    get needsDateSeparator(): boolean {
        return false;
    }

    createDateSeparator(): undefined {
        return undefined;
    }

/**
 * _findTileIdx in TilesCollection should never return
 * the index of a DateTile as that is mainly used
 * for mapping incoming event indices coming from the Timeline
 * to the tile index to propage the event.
 * This is not a path that is relevant to date headers as they
 * are added as a side-effect of adding other tiles and are generally
 * not updated (only removed in some cases). _findTileIdx is also
 * used for emitting spontanous updates, but that should also not be
 * needed for a DateTile.
 * The problem is basically that _findTileIdx maps an entry to
 * a tile, and DateTile adopts the entry of it's sibling tile (_firstTileInDay)
 * so now we have the entry pointing to two tiles. So we should avoid
 * returning the DateTile itself from the compare method.
 * We will always return -1 or 1 from here to signal an entry comes before or after us,
 * never 0
 * */
    compareEntry(entry: BaseEntry): number {
        const result = this.refEntry.compare(entry);
        if (result === 0) {
            // if it's a match for the reference entry (e.g. _firstTileInDay),
            // say it comes after us as the date tile always comes at the top
            // of the day.
            return -1;
        }
        // otherwise, assume the given entry is never for ourselves
        // as we don't have our own entry, we only borrow one from _firstTileInDay
        return result;
    }

    // update received for already included (falls within sort keys) entry
    updateEntry(entry, param): UpdateAction {
        return UpdateAction.Nothing();
    }

    // return whether the tile should be removed
    // as SimpleTile only has one entry, the tile should be removed
    removeEntry(entry: BaseEntry): boolean {
        return false;
    }

    // SimpleTile can only contain 1 entry
    tryIncludeEntry(): boolean {
        return false;
    }

    // let item know it has a new sibling
    updatePreviousSibling(prev: ITile<BaseEntry> | undefined): void {
        // forward the sibling update to our next tile, so it is informed
        // about it's previous sibling beyond the date header (which is it's direct previous sibling)
        // so it can recalculate whether it still needs a date header
        this._firstTileInDay.updatePreviousSibling(prev);
    }

    // let item know it has a new sibling
    updateNextSibling(next: ITile<BaseEntry> | undefined): UpdateAction {
        // TODO: next can be undefined when a pending event is removed
        // TODO: we need a way to remove this date header
        this._firstTileInDay = next!;
        const prevDateString = this._dateString;
        this._dateString = undefined;
        if (prevDateString && prevDateString !== this.date) {
            this._emitUpdate?.(this, "date");
        }
    }

    notifyVisible(): void {
        // trigger sticky logic here?
    }

    dispose(): void {

    }
}
