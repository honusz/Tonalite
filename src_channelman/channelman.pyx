def calculate_chans(chans, output_chans, isubmasters):
    """Calculate the output channel values from the current cue, submasters, and channel settings"""
    o_chans = [0] * 48
    for i, _ in enumerate(chans):
        if output_chans[i] != None:
            o_chans[i] = output_chans[i]
        else:
            o_chans[i] = chans[i]
            for i, _ in enumerate(isubmasters):
                for chan, _ in enumerate(isubmasters[i]["channels"]):
                    subChanValue = int(isubmasters[i]["value"] / 100 * isubmasters[i]["channels"][chan]["value"])
                    outChanValue = o_chans[int(isubmasters[i]["channels"][chan]["channel"]) - 1]
                    if subChanValue > outChanValue:
                        o_chans[int(isubmasters[i]["channels"][chan]["channel"]) - 1] = subChanValue
    return o_chans
