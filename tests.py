import unittest

from channelman import calculate_chans


class TestChannelCalc(unittest.TestCase):

    def test_simple_calc(self):
        """Test with simple channels set as would be if a cue was active"""
        chans = [255] * 48
        output_chans = [None] * 48
        self.assertEqual(calculate_chans(chans, output_chans, [], 50), [127]*48)
    
    def test_output_chans_calc(self):
        """Test to make sure keyboard channels overwrite regular channels"""
        chans = [17] * 48
        output_chans = ([None] * 10) + ([25] * 24) + ([None] * 14)
        supposedOutput = ([17] * 10) + ([25] * 24) + ([17] * 14)
        self.assertEqual(calculate_chans(chans, output_chans, [], 100), supposedOutput)


if __name__ == '__main__':
    unittest.main()
