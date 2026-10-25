// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const mocks=vi.hoisted(()=>({getKioskPair:vi.fn(),submitKiosk:vi.fn(),unlockKiosk:vi.fn(),finishStaffReturn:vi.fn()}));
vi.mock('../services/kioskDeviceService',()=>mocks);
import PairedKiosk from '../components/PairedKiosk';
const pair={deviceId:'demo-device',deviceSecret:'a'.repeat(64),location:'Houston'};
beforeEach(()=>{vi.clearAllMocks();mocks.getKioskPair.mockReturnValue(pair);mocks.submitKiosk.mockResolvedValue({ok:true});});
afterEach(cleanup);
it('submits a Houston intake and immediately clears customer identity and marketing consent',async()=>{
 render(<PairedKiosk location="Houston"/>);
 fireEvent.change(screen.getByLabelText(/Full Name/),{target:{value:'Sample Customer'}});
 fireEvent.change(screen.getByLabelText('Phone Number *'),{target:{value:'4095551212'}});
 fireEvent.change(screen.getByLabelText(/Device Brand/),{target:{value:'Apple'}});
 fireEvent.change(screen.getByLabelText(/Device Model/),{target:{value:'iPhone 12'}});
 fireEvent.change(screen.getByLabelText(/How did you hear/),{target:{value:'Google'}});
 fireEvent.change(screen.getByLabelText(/What type of repair/),{target:{value:'Screen'}});
 fireEvent.click(screen.getByRole('button',{name:'Submit Ticket'}));
 await screen.findByText('Thank You!');
 expect(mocks.submitKiosk).toHaveBeenCalledWith(pair,expect.objectContaining({name:'Sample Customer',requestId:expect.any(String)}));
 expect((screen.getByLabelText(/Full Name/) as HTMLInputElement).value).toBe('');
 expect((screen.getByLabelText('Phone Number *') as HTMLInputElement).value).toBe('');
});
it('returning to the dashboard always opens the server PIN gate, not a local default PIN',async()=>{
 render(<PairedKiosk location="Houston"/>);fireEvent.click(screen.getByRole('button',{name:'Return to staff dashboard'}));
 expect(screen.getByRole('dialog')).toBeTruthy();expect(mocks.unlockKiosk).not.toHaveBeenCalled();
 mocks.unlockKiosk.mockRejectedValue(new Error('Wrong PIN'));
 fireEvent.change(screen.getByLabelText('Return PIN'),{target:{value:'938271'}});
 fireEvent.click(screen.getByRole('button',{name:'Unlock dashboard'}));
 await waitFor(()=>expect(mocks.unlockKiosk).toHaveBeenCalledWith(pair,'938271'));
 expect((await screen.findAllByText('Wrong PIN')).length).toBeGreaterThan(0);expect((screen.getByLabelText('Return PIN') as HTMLInputElement).value).toBe('');
});
it('an unpaired iPad cannot submit a customer record',()=>{
 mocks.getKioskPair.mockReturnValue(null);render(<PairedKiosk location="Houston"/>);
 expect((screen.getByRole('button',{name:'Submit Ticket'}) as HTMLButtonElement).disabled).toBe(true);
});
