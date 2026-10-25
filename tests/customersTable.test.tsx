// @vitest-environment jsdom
import React from 'react';
import { afterEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import CustomersTableView from '../components/CustomersTableView';
afterEach(cleanup);
const customers=Array.from({length:125},(_,index)=>({id:`c${index}`,name:`Customer ${index}`,phone:`409555${String(index).padStart(4,'0')}`,email:index===99?'needle@example.test':''})) as any;
it('renders only 50 rows at once while retaining access to every customer',()=>{
 const select=vi.fn();render(<CustomersTableView customers={customers} onSelectCustomer={select} onAddNew={()=>{}}/>);
 expect(screen.getAllByRole('row')).toHaveLength(51);expect(screen.getByText('Page 1 of 3')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Next'}));expect(screen.getByText('Page 2 of 3')).toBeTruthy();
 expect(screen.queryByText('Customer 0')).toBeNull();fireEvent.click(within(screen.getByText('Customer 50').closest('tr')!).getByRole('button',{name:'View'}));expect(select).toHaveBeenCalledWith('c50');
 fireEvent.click(screen.getByRole('button',{name:'Next'}));expect(screen.getAllByRole('row')).toHaveLength(26);
});
it('name/email searches do not match every phone number when the search contains no digits',async()=>{
 render(<CustomersTableView customers={customers} onSelectCustomer={()=>{}} onAddNew={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'needle'}});
 expect(await screen.findByText('Customer 99')).toBeTruthy();expect(screen.getAllByRole('row')).toHaveLength(2);
 expect(screen.getByText('Page 1 of 1')).toBeTruthy();expect(screen.queryByText('Customer 0')).toBeNull();
});
