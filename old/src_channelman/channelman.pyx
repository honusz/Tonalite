def calculate_chans(chans, output_chans, isubmasters, grandmaster):
    """Calculate the output channel values from the current cue, submasters, and channel settings"""
    o_chans = [0] * 48
    for i, _ in enumerate(chans):
        if output_chans[i] != None:
            o_chans[i] = output_chans[i]
        else:
            o_chans[i] = chans[i]
            
            for i, _ in enumerate(isubmasters):
                for chan, _ in enumerate(isubmasters[i]["channels"]):
                    # Get what the output value will be
                    outChanValue = o_chans[int(isubmasters[i]["channels"][chan]["channel"]) - 1]
                    # Convert the sub chan value to 0-255
                    subChanValue = 2.55 * isubmasters[i]["channels"][chan]["value"]
                    # Get the percentage of the sub chan value from the submaster
                    subChanValue = int((subChanValue/100) * isubmasters[i]["value"])
                    if subChanValue > outChanValue:
                        o_chans[int(isubmasters[i]["channels"][chan]["channel"]) - 1] = subChanValue

    for i, _ in enumerate(o_chans):
        o_chans[i] = int((o_chans[i]/100.0) * grandmaster)
    return o_chans
